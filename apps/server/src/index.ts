import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import {
  type CommandAckPayload,
} from "@luna/protocol";
import { randomUUID } from "node:crypto";
import type { Socket } from "node:dgram";
import {
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse,
} from "node:http";
import { WebSocket, type WebSocketServer } from "ws";
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
import { isNonEmptyString } from "./utils/value";
import {
  startServerRuntime,
  stopServerRuntime,
} from "./server-runtime";
import { PresenceService } from "./presence-service";

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
  const presenceService = new PresenceService({
    devices,
    deviceSockets,
    heartbeatTimeoutMs,
  });

  const getRegisteredDevices = (): Device[] => Array.from(devices.values());
  const getDiscoveredAgents = (): DiscoveredAgent[] =>
    Array.from(discoveredAgents.values());
  const getCommandHistory = (): Command[] => [...commandHistory];

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

    const startedRuntime = await startServerRuntime({
      host,
      port,
      handleRequest,
      websocketHandlers: {
        devices,
        customDeviceAliases,
        commandHistory,
        deviceSockets,
        socketDeviceIds,
        pendingCommandAcks,
        presenceService,
      },
      devices,
      discoveredAgents,
    });
    httpServer = startedRuntime.httpServer;
    webSocketServer = startedRuntime.webSocketServer;
    discoverySocket = startedRuntime.discoverySocket;
    port = startedRuntime.port;
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

    presenceService.clearAllHeartbeatTimeouts();

    const currentHttpServer = httpServer;
    const currentWebSocketServer = webSocketServer;
    const currentDiscoverySocket = discoverySocket;
    httpServer = undefined;
    webSocketServer = undefined;
    discoverySocket = undefined;

    await stopServerRuntime({
      httpServer: currentHttpServer,
      webSocketServer: currentWebSocketServer,
      discoverySocket: currentDiscoverySocket,
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
