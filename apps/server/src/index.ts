import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import {
  type CommandAckPayload,
} from "@luna/protocol";
import { randomUUID } from "node:crypto";
import type { Socket } from "node:dgram";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import {
  createCommandDispatcher,
  type PendingCommandAck,
} from "./command-dispatcher";
import { sendJson, sendNoContent } from "./utils/http";
import { createHttpRequestHandlers } from "./http-request-handlers";
import {
  extractDeviceIdFromPatchRoute,
  extractDiscoveredAgentIdFromApproveRoute,
} from "./utils/route";
import { isNonEmptyString, normalizeWhitespace } from "./utils/value";
import {
  registerWebSocketConnectionHandlers,
} from "./websocket-connection-handlers";
import {
  startAgentDiscoveryUdp,
  stopAgentDiscoveryUdp,
} from "./agent-discovery-udp";

export const serverBootstrapReady = true;

export interface LunaServerOptions {
  host?: string;
  port?: number;
  heartbeatTimeoutMs?: number;
}

export interface LunaServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPort: () => number;
  getRegisteredDevices: () => Device[];
  getDiscoveredAgents: () => DiscoveredAgent[];
  getCommandHistory: () => Command[];
  dispatchCommand: (
    input: DispatchCommandInput,
  ) => Promise<DispatchCommandAcknowledgement>;
}

export interface DispatchCommandInput {
  rawText?: string;
  targetDeviceId: string;
  intent: string;
  params: Record<string, unknown>;
  ackTimeoutMs?: number;
}

export interface DispatchCommandAcknowledgement {
  commandId: string;
  targetDeviceId: string;
  status: CommandAckPayload["status"];
  reason?: string;
}

export const createLunaServer = (
  options: LunaServerOptions = {},
): LunaServer => {
  const devices = new Map<string, Device>();
  const discoveredAgents = new Map<string, DiscoveredAgent>();
  const customDeviceAliases = new Map<string, string>();
  const commandHistory: Command[] = [];
  const deviceSockets = new Map<string, WebSocket>();
  const socketDeviceIds = new WeakMap<WebSocket, string>();
  const pendingCommandAcks = new Map<string, PendingCommandAck>();
  const host = options.host ?? "127.0.0.1";
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15_000;
  let port = options.port ?? 0;
  let httpServer: HttpServer | undefined;
  let webSocketServer: WebSocketServer | undefined;
  let discoverySocket: Socket | undefined;
  const heartbeatTimeouts = new Map<string, NodeJS.Timeout>();

  const getRegisteredDevices = (): Device[] => Array.from(devices.values());
  const getDiscoveredAgents = (): DiscoveredAgent[] =>
    Array.from(discoveredAgents.values());
  const getCommandHistory = (): Command[] => [...commandHistory];

  const clearHeartbeatTimeout = (deviceId: string): void => {
    const timeoutHandle = heartbeatTimeouts.get(deviceId);
    if (!timeoutHandle) {
      return;
    }

    clearTimeout(timeoutHandle);
    heartbeatTimeouts.delete(deviceId);
  };

  const markDeviceOffline = (deviceId: string): void => {
    const device = devices.get(deviceId);
    if (!device) {
      return;
    }

    devices.set(deviceId, {
      ...device,
      status: "offline",
    });
  };

  const armHeartbeatTimeout = (deviceId: string, socket: WebSocket): void => {
    clearHeartbeatTimeout(deviceId);

    const timeoutHandle = setTimeout(() => {
      heartbeatTimeouts.delete(deviceId);
      if (deviceSockets.get(deviceId) !== socket) {
        return;
      }

      deviceSockets.delete(deviceId);
      markDeviceOffline(deviceId);
      socket.terminate();
    }, heartbeatTimeoutMs);

    heartbeatTimeouts.set(deviceId, timeoutHandle);
  };

  const dispatchCommand = createCommandDispatcher({
    devices,
    commandHistory,
    deviceSockets,
    pendingCommandAcks,
    createCommandId: randomUUID,
  });

  const {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  } = createHttpRequestHandlers({
    devices,
    discoveredAgents,
    customDeviceAliases,
    dispatchCommand,
  });

  const handleRequest = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    if (request.method === "OPTIONS") {
      sendNoContent(response);
      return;
    }

    if (request.method === "GET" && request.url === "/devices") {
      sendJson(response, 200, getRegisteredDevices());
      return;
    }

    if (request.method === "GET" && request.url === "/commands") {
      sendJson(response, 200, getCommandHistory());
      return;
    }

    if (request.method === "GET" && request.url === "/discovery/agents") {
      sendJson(response, 200, getDiscoveredAgents());
      return;
    }

    if (request.method === "POST" && request.url === "/commands") {
      void handleSubmitCommand(request, response);
      return;
    }

    if (request.method === "PATCH" && isNonEmptyString(request.url)) {
      const deviceId = extractDeviceIdFromPatchRoute(request.url);
      if (deviceId) {
        void handleRenameDevice(request, response, deviceId);
        return;
      }
    }

    if (request.method === "POST" && isNonEmptyString(request.url)) {
      const discoveredAgentId = extractDiscoveredAgentIdFromApproveRoute(
        request.url,
      );
      if (discoveredAgentId) {
        handleApproveDiscoveredAgent(response, discoveredAgentId);
        return;
      }
    }

    sendJson(response, 404, { message: "Not Found" });
  };

  const start = async (): Promise<void> => {
    if (httpServer || webSocketServer) {
      return;
    }

    httpServer = createServer(handleRequest);
    webSocketServer = new WebSocketServer({ server: httpServer });

    registerWebSocketConnectionHandlers({
      webSocketServer,
      devices,
      customDeviceAliases,
      commandHistory,
      deviceSockets,
      socketDeviceIds,
      pendingCommandAcks,
      clearHeartbeatTimeout,
      markDeviceOffline,
      armHeartbeatTimeout,
    });

    await new Promise<void>((resolve, reject) => {
      if (!httpServer) {
        reject(new Error("HTTP server is not initialized."));
        return;
      }

      const handleListening = () => {
        httpServer?.off("error", handleError);
        resolve();
      };

      const handleError = (error: Error) => {
        httpServer?.off("listening", handleListening);
        reject(error);
      };

      httpServer.once("listening", handleListening);
      httpServer.once("error", handleError);
      httpServer.listen(port, host);
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("HTTP server did not expose a TCP address.");
    }

    port = (address as AddressInfo).port;
    discoverySocket = await startAgentDiscoveryUdp({
      host,
      port,
      devices,
      discoveredAgents,
    });
  };

  const stop = async (): Promise<void> => {
    if (!httpServer || !webSocketServer) {
      return;
    }

    for (const [commandId, pendingAck] of pendingCommandAcks.entries()) {
      clearTimeout(pendingAck.timeoutHandle);
      pendingAck.reject(
        new Error(`Server stopped before ack for command ${commandId}.`),
      );
      pendingCommandAcks.delete(commandId);
    }

    for (const timeoutHandle of heartbeatTimeouts.values()) {
      clearTimeout(timeoutHandle);
    }
    heartbeatTimeouts.clear();

    const currentHttpServer = httpServer;
    const currentWebSocketServer = webSocketServer;
    const currentDiscoverySocket = discoverySocket;
    httpServer = undefined;
    webSocketServer = undefined;
    discoverySocket = undefined;

    await new Promise<void>((resolve, reject) => {
      currentWebSocketServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      currentHttpServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await stopAgentDiscoveryUdp(currentDiscoverySocket);
  };

  return {
    start,
    stop,
    getPort: () => port,
    getRegisteredDevices,
    getDiscoveredAgents,
    getCommandHistory,
    dispatchCommand,
  };
};
