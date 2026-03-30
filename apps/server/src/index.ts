import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import {
  createCommandDispatchMessage,
  parseAgentDiscoveryAnnounceMessage,
  parseAgentHeartbeatMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import { randomUUID } from "node:crypto";
import { createSocket, type Socket } from "node:dgram";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket, WebSocketServer } from "ws";
import {
  supportsIntent,
} from "./utils/device";
import { sendJson, sendNoContent } from "./utils/http";
import { createHttpRequestHandlers } from "./http-request-handlers";
import {
  extractDeviceIdFromPatchRoute,
  extractDiscoveredAgentIdFromApproveRoute,
} from "./utils/route";
import { isNonEmptyString, normalizeWhitespace } from "./utils/value";

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

interface PendingCommandAck {
  rawText: string;
  intent: string;
  params: Record<string, unknown>;
  targetDeviceId: string;
  timeoutHandle: NodeJS.Timeout;
  resolve: (ack: DispatchCommandAcknowledgement) => void;
  reject: (error: Error) => void;
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

  const findDeviceById = (deviceId: string): Device | null =>
    devices.get(deviceId) ?? null;

  const {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  } = createHttpRequestHandlers({
    devices,
    discoveredAgents,
    customDeviceAliases,
    dispatchCommand: (input) => dispatchCommand(input),
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
        clearHeartbeatTimeout(deviceId);
        markDeviceOffline(deviceId);
      });

      socket.on("message", (rawMessage) => {
        const serializedMessage = rawMessage.toString();
        const registerMessage = parseAgentRegisterMessage(serializedMessage);
        if (registerMessage) {
          const deviceId = normalizeWhitespace(registerMessage.payload.id);
          const registerName = normalizeWhitespace(
            registerMessage.payload.name,
          );
          const registerHostname = normalizeWhitespace(
            registerMessage.payload.hostname,
          );
          const aliasName = customDeviceAliases.get(deviceId);

          devices.set(deviceId, {
            id: deviceId,
            name: aliasName ?? registerName,
            hostname: registerHostname,
            status: "online",
            capabilities: [...registerMessage.payload.capabilities],
          });
          deviceSockets.set(deviceId, socket);
          socketDeviceIds.set(socket, deviceId);
          armHeartbeatTimeout(deviceId, socket);
          return;
        }

        const heartbeatMessage = parseAgentHeartbeatMessage(serializedMessage);
        if (heartbeatMessage) {
          const heartbeatDeviceId = socketDeviceIds.get(socket);
          if (!heartbeatDeviceId) {
            return;
          }

          if (deviceSockets.get(heartbeatDeviceId) !== socket) {
            return;
          }

          armHeartbeatTimeout(heartbeatDeviceId, socket);
          return;
        }

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

    discoverySocket = createSocket("udp4");
    discoverySocket.on("message", (messageBuffer) => {
      const announceMessage = parseAgentDiscoveryAnnounceMessage(
        messageBuffer.toString("utf-8"),
      );
      if (!announceMessage) {
        return;
      }

      const discoveredAgentId = normalizeWhitespace(announceMessage.payload.id);
      if (devices.has(discoveredAgentId)) {
        discoveredAgents.delete(discoveredAgentId);
        return;
      }

      discoveredAgents.set(discoveredAgentId, {
        id: discoveredAgentId,
        hostname: normalizeWhitespace(announceMessage.payload.hostname),
        capabilities: [...announceMessage.payload.capabilities],
      });
    });

    await new Promise<void>((resolve, reject) => {
      if (!discoverySocket) {
        reject(new Error("Discovery socket is not initialized."));
        return;
      }

      const handleListening = () => {
        discoverySocket?.off("error", handleError);
        resolve();
      };

      const handleError = (error: Error) => {
        discoverySocket?.off("listening", handleListening);
        reject(error);
      };

      discoverySocket.once("listening", handleListening);
      discoverySocket.once("error", handleError);
      discoverySocket.bind(port, host);
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

    if (currentDiscoverySocket) {
      await new Promise<void>((resolve) => {
        currentDiscoverySocket.close(() => resolve());
      });
    }
  };

  const dispatchCommand = async (
    input: DispatchCommandInput,
  ): Promise<DispatchCommandAcknowledgement> => {
    const socket = deviceSockets.get(input.targetDeviceId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${input.targetDeviceId} is not connected.`);
    }

    const commandId = randomUUID();
    const targetDevice = findDeviceById(input.targetDeviceId);
    if (targetDevice && !supportsIntent(targetDevice, input.intent)) {
      commandHistory.push({
        id: commandId,
        rawText: input.rawText ?? "",
        intent: input.intent,
        targetDeviceId: input.targetDeviceId,
        params: input.params,
        status: "failed",
        reason: "unsupported_intent",
      });

      return {
        commandId,
        targetDeviceId: input.targetDeviceId,
        status: "failed",
        reason: "unsupported_intent",
      };
    }

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
    getDiscoveredAgents,
    getCommandHistory,
    dispatchCommand,
  };
};
