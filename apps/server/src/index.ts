import type { Device } from "@luna/shared-types";
import {
  createCommandDispatchMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
  type CommandAckPayload
} from "@luna/protocol";
import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse
} from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";

export const serverBootstrapReady = true;

export interface LunaServerOptions {
  host?: string;
  port?: number;
}

export interface LunaServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPort: () => number;
  getRegisteredDevices: () => Device[];
  dispatchCommand: (
    input: DispatchCommandInput
  ) => Promise<DispatchCommandAcknowledgement>;
}

export interface DispatchCommandInput {
  targetDeviceId: string;
  intent: string;
  params: Record<string, unknown>;
  ackTimeoutMs?: number;
}

export interface DispatchCommandAcknowledgement {
  commandId: string;
  targetDeviceId: string;
  status: CommandAckPayload["status"];
}

interface PendingCommandAck {
  targetDeviceId: string;
  timeoutHandle: NodeJS.Timeout;
  resolve: (ack: DispatchCommandAcknowledgement) => void;
  reject: (error: Error) => void;
}

export const createLunaServer = (options: LunaServerOptions = {}): LunaServer => {
  const devices = new Map<string, Device>();
  const deviceSockets = new Map<string, WebSocket>();
  const socketDeviceIds = new WeakMap<WebSocket, string>();
  const pendingCommandAcks = new Map<string, PendingCommandAck>();
  const host = options.host ?? "127.0.0.1";
  let port = options.port ?? 0;
  let httpServer: HttpServer | undefined;
  let webSocketServer: WebSocketServer | undefined;

  const getRegisteredDevices = (): Device[] => Array.from(devices.values());

  const handleRequest = (_request: IncomingMessage, response: ServerResponse): void => {
    if (_request.method === "GET" && _request.url === "/devices") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(getRegisteredDevices()));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Not Found" }));
  };

  const start = async (): Promise<void> => {
    if (httpServer || webSocketServer) {
      return;
    }

    httpServer = createServer(handleRequest);
    webSocketServer = new WebSocketServer({ server: httpServer });

    webSocketServer.on("connection", (socket) => {
      socket.on("close", () => {
        const deviceId = socketDeviceIds.get(socket);
        if (!deviceId) {
          return;
        }

        if (deviceSockets.get(deviceId) === socket) {
          deviceSockets.delete(deviceId);
        }
      });

      socket.on("message", (rawMessage) => {
        const serializedMessage = rawMessage.toString();
        const registerMessage = parseAgentRegisterMessage(serializedMessage);
        if (!registerMessage) {
          const commandAckMessage = parseCommandAckMessage(serializedMessage);
          if (!commandAckMessage) {
            return;
          }

          const pendingAck = pendingCommandAcks.get(
            commandAckMessage.payload.commandId
          );
          if (!pendingAck) {
            return;
          }

          const ackDeviceId = socketDeviceIds.get(socket);
          if (!ackDeviceId || ackDeviceId !== pendingAck.targetDeviceId) {
            return;
          }

          pendingCommandAcks.delete(commandAckMessage.payload.commandId);
          clearTimeout(pendingAck.timeoutHandle);
          pendingAck.resolve({
            commandId: commandAckMessage.payload.commandId,
            targetDeviceId: pendingAck.targetDeviceId,
            status: commandAckMessage.payload.status
          });
          return;
        }

        devices.set(registerMessage.payload.id, {
          ...registerMessage.payload,
          status: "online"
        });
        deviceSockets.set(registerMessage.payload.id, socket);
        socketDeviceIds.set(socket, registerMessage.payload.id);
      });
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
  };

  const stop = async (): Promise<void> => {
    if (!httpServer || !webSocketServer) {
      return;
    }

    for (const [commandId, pendingAck] of pendingCommandAcks.entries()) {
      clearTimeout(pendingAck.timeoutHandle);
      pendingAck.reject(
        new Error(`Server stopped before ack for command ${commandId}.`)
      );
      pendingCommandAcks.delete(commandId);
    }

    const currentHttpServer = httpServer;
    const currentWebSocketServer = webSocketServer;
    httpServer = undefined;
    webSocketServer = undefined;

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
  };

  const dispatchCommand = async (
    input: DispatchCommandInput
  ): Promise<DispatchCommandAcknowledgement> => {
    const socket = deviceSockets.get(input.targetDeviceId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${input.targetDeviceId} is not connected.`);
    }

    const commandId = randomUUID();
    const serializedDispatchMessage = JSON.stringify(
      createCommandDispatchMessage({
        commandId,
        intent: input.intent,
        params: input.params
      })
    );

    return new Promise<DispatchCommandAcknowledgement>((resolve, reject) => {
      const ackTimeoutMs = input.ackTimeoutMs ?? 1_000;
      const timeoutHandle = setTimeout(() => {
        pendingCommandAcks.delete(commandId);
        reject(
          new Error(
            `Timed out waiting for ack from device ${input.targetDeviceId}.`
          )
        );
      }, ackTimeoutMs);

      pendingCommandAcks.set(commandId, {
        targetDeviceId: input.targetDeviceId,
        timeoutHandle,
        resolve,
        reject
      });

      socket.send(serializedDispatchMessage, (error) => {
        if (!error) {
          return;
        }

        clearTimeout(timeoutHandle);
        pendingCommandAcks.delete(commandId);
        reject(error);
      });
    });
  };

  return {
    start,
    stop,
    getPort: () => port,
    getRegisteredDevices,
    dispatchCommand
  };
};
