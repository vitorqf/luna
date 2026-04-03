import type { Socket } from "node:dgram";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";
import type {
  DeviceRepository,
  DiscoveredAgentRepository,
} from "./repositories/ports";
import { startAgentDiscoveryUdp, stopAgentDiscoveryUdp } from "./agent-discovery-udp";
import {
  registerWebSocketConnectionHandlers,
  type RegisterWebSocketConnectionHandlersInput,
} from "./websocket-connection-handlers";

export interface StartedServerRuntime {
  httpServer: HttpServer;
  webSocketServer: WebSocketServer;
  discoverySocket: Socket;
  port: number;
}

export interface StartServerRuntimeInput {
  host: string;
  port: number;
  handleRequest: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => void;
  websocketHandlers: Omit<
    RegisterWebSocketConnectionHandlersInput,
    "webSocketServer"
  >;
  deviceRepository: DeviceRepository;
  discoveredAgentRepository: DiscoveredAgentRepository;
}

export const startServerRuntime = async (
  input: StartServerRuntimeInput,
): Promise<StartedServerRuntime> => {
  const httpServer = createServer(input.handleRequest);
  const webSocketServer = new WebSocketServer({ server: httpServer });
  registerWebSocketConnectionHandlers({
    webSocketServer,
    ...input.websocketHandlers,
  });

  await new Promise<void>((resolve, reject) => {
    const handleListening = () => {
      httpServer.off("error", handleError);
      resolve();
    };

    const handleError = (error: Error) => {
      httpServer.off("listening", handleListening);
      reject(error);
    };

    httpServer.once("listening", handleListening);
    httpServer.once("error", handleError);
    httpServer.listen(input.port, input.host);
  });

  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("HTTP server did not expose a TCP address.");
  }
  const runtimePort = (address as AddressInfo).port;

  const discoverySocket = await startAgentDiscoveryUdp({
    host: input.host,
    port: runtimePort,
    deviceRepository: input.deviceRepository,
    discoveredAgentRepository: input.discoveredAgentRepository,
  });

  return {
    httpServer,
    webSocketServer,
    discoverySocket,
    port: runtimePort,
  };
};

export const stopServerRuntime = async (
  runtime: {
    httpServer: HttpServer;
    webSocketServer: WebSocketServer;
    discoverySocket: Socket | undefined;
  },
): Promise<void> => {
  for (const client of runtime.webSocketServer.clients) {
    client.terminate();
  }

  await new Promise<void>((resolve, reject) => {
    runtime.webSocketServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await new Promise<void>((resolve, reject) => {
    runtime.httpServer.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

  await stopAgentDiscoveryUdp(runtime.discoverySocket);
};
