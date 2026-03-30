import type { Command, Device } from "@luna/shared-types";
import { parseCommand } from "@luna/command-parser";
import {
  createCommandDispatchMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import { randomUUID } from "node:crypto";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
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

interface PendingCommandAck {
  rawText: string;
  intent: string;
  params: Record<string, unknown>;
  targetDeviceId: string;
  timeoutHandle: NodeJS.Timeout;
  resolve: (ack: DispatchCommandAcknowledgement) => void;
  reject: (error: Error) => void;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const CORS_ALLOW_ORIGIN = "*";
const CORS_ALLOW_METHODS = "GET,POST,OPTIONS";
const CORS_ALLOW_HEADERS = "content-type";

const setCorsHeaders = (response: ServerResponse): void => {
  response.setHeader("access-control-allow-origin", CORS_ALLOW_ORIGIN);
  response.setHeader("access-control-allow-methods", CORS_ALLOW_METHODS);
  response.setHeader("access-control-allow-headers", CORS_ALLOW_HEADERS);
};

const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

const sendNoContent = (response: ServerResponse): void => {
  setCorsHeaders(response);
  response.writeHead(204);
  response.end();
};

const readRawRequestBody = async (
  request: IncomingMessage,
): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
};

export const createLunaServer = (
  options: LunaServerOptions = {},
): LunaServer => {
  const devices = new Map<string, Device>();
  const commandHistory: Command[] = [];
  const deviceSockets = new Map<string, WebSocket>();
  const socketDeviceIds = new WeakMap<WebSocket, string>();
  const pendingCommandAcks = new Map<string, PendingCommandAck>();
  const host = options.host ?? "127.0.0.1";
  let port = options.port ?? 0;
  let httpServer: HttpServer | undefined;
  let webSocketServer: WebSocketServer | undefined;

  const getRegisteredDevices = (): Device[] => Array.from(devices.values());
  const getCommandHistory = (): Command[] => [...commandHistory];

  const resolveDeviceByName = (deviceName: string): Device | null => {
    const normalizedDeviceName = deviceName.trim().toLocaleLowerCase();
    for (const device of devices.values()) {
      if (device.name.trim().toLocaleLowerCase() === normalizedDeviceName) {
        return device;
      }
    }

    return null;
  };

  const handleSubmitCommand = async (
    request: IncomingMessage,
    response: ServerResponse,
  ): Promise<void> => {
    let payload: unknown;

    try {
      const rawBody = await readRawRequestBody(request);
      payload = JSON.parse(rawBody);
    } catch {
      sendJson(response, 400, { message: "Invalid JSON body." });
      return;
    }

    if (!isRecord(payload) || !isNonEmptyString(payload.rawText)) {
      sendJson(response, 400, { message: "rawText is required." });
      return;
    }

    const rawText = payload.rawText.trim();
    const parsedCommand = parseCommand(rawText);
    if (!parsedCommand) {
      sendJson(response, 422, { message: "Unable to parse command." });
      return;
    }

    const targetDevice = resolveDeviceByName(parsedCommand.targetDeviceName);
    if (!targetDevice) {
      sendJson(response, 404, { message: "Target device is not registered." });
      return;
    }

    try {
      const ack = await dispatchCommand({
        rawText,
        targetDeviceId: targetDevice.id,
        intent: parsedCommand.intent,
        params: parsedCommand.params,
      });

      sendJson(response, 200, ack);
    } catch {
      sendJson(response, 500, { message: "Failed to dispatch command." });
    }
  };

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

    if (request.method === "POST" && request.url === "/commands") {
      void handleSubmitCommand(request, response);
      return;
    }

    sendJson(response, 404, { message: "Not Found" });
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

        if (deviceSockets.get(deviceId) !== socket) {
          return;
        }

        deviceSockets.delete(deviceId);
        const device = devices.get(deviceId);
        if (!device) {
          return;
        }

        devices.set(deviceId, {
          ...device,
          status: "offline",
        });
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
            commandAckMessage.payload.commandId,
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
          if (commandAckMessage.payload.status === "failed") {
            commandHistory.push({
              id: commandAckMessage.payload.commandId,
              rawText: pendingAck.rawText,
              intent: pendingAck.intent,
              targetDeviceId: pendingAck.targetDeviceId,
              params: pendingAck.params,
              status: "failed",
              reason: commandAckMessage.payload.reason,
            });
            pendingAck.resolve({
              commandId: commandAckMessage.payload.commandId,
              targetDeviceId: pendingAck.targetDeviceId,
              status: "failed",
              reason: commandAckMessage.payload.reason,
            });
            return;
          }

          commandHistory.push({
            id: commandAckMessage.payload.commandId,
            rawText: pendingAck.rawText,
            intent: pendingAck.intent,
            targetDeviceId: pendingAck.targetDeviceId,
            params: pendingAck.params,
            status: "success",
          });
          pendingAck.resolve({
            commandId: commandAckMessage.payload.commandId,
            targetDeviceId: pendingAck.targetDeviceId,
            status: "success",
          });
          return;
        }

        devices.set(registerMessage.payload.id, {
          ...registerMessage.payload,
          status: "online",
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
        new Error(`Server stopped before ack for command ${commandId}.`),
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
    input: DispatchCommandInput,
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
        params: input.params,
      }),
    );

    return new Promise<DispatchCommandAcknowledgement>((resolve, reject) => {
      const ackTimeoutMs = input.ackTimeoutMs ?? 1_000;
      const timeoutHandle = setTimeout(() => {
        pendingCommandAcks.delete(commandId);
        reject(
          new Error(
            `Timed out waiting for ack from device ${input.targetDeviceId}.`,
          ),
        );
      }, ackTimeoutMs);

      pendingCommandAcks.set(commandId, {
        rawText: input.rawText ?? "",
        intent: input.intent,
        params: input.params,
        targetDeviceId: input.targetDeviceId,
        timeoutHandle,
        resolve,
        reject,
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
    getCommandHistory,
    dispatchCommand,
  };
};
