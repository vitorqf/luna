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
import { type WebSocketServer } from "ws";
import {
  createCommandDispatcher,
  type PendingCommandAck,
} from "./command-dispatcher";
import {
  loadPersistedServerState,
  savePersistedServerState,
} from "./server-state-store";
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
import {
  createInMemoryCommandHistoryRepository,
  createInMemoryConnectionRepository,
  createInMemoryDeviceAliasRepository,
  createInMemoryDeviceRepository,
  createInMemoryDiscoveredAgentRepository,
  createInMemoryPendingAckRepository,
} from "./repositories/in-memory";
import { serveStaticAsset } from "./static-web";

export const serverBootstrapReady = true;

export interface LunaServerOptions {
  host?: string;
  port?: number;
  heartbeatTimeoutMs?: number;
  staticDir?: string | undefined;
  stateFile?: string;
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
  const deviceRepository = createInMemoryDeviceRepository();
  const discoveredAgentRepository = createInMemoryDiscoveredAgentRepository();
  const deviceAliasRepository = createInMemoryDeviceAliasRepository();
  const commandHistoryRepository = createInMemoryCommandHistoryRepository();
  const connectionRepository = createInMemoryConnectionRepository();
  const pendingAckRepository =
    createInMemoryPendingAckRepository<PendingCommandAck>();
  const host = options.host ?? "127.0.0.1";
  const heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 15_000;
  const staticDir = options.staticDir;
  const stateFile = options.stateFile;
  let port = options.port ?? 0;
  let httpServer: HttpServer | undefined;
  let webSocketServer: WebSocketServer | undefined;
  let discoverySocket: Socket | undefined;
  const persistState = (): void => {
    if (!stateFile) {
      return;
    }

    savePersistedServerState(stateFile, {
      devices: deviceRepository.list(),
      customDeviceAliases: deviceAliasRepository.toRecord(),
      commandHistory: commandHistoryRepository.list(),
    });
  };
  const presenceService = new PresenceService({
    deviceRepository,
    connectionRepository,
    heartbeatTimeoutMs,
    onDeviceOffline: persistState,
  });

  const getRegisteredDevices = (): Device[] => deviceRepository.list();
  const getDiscoveredAgents = (): DiscoveredAgent[] =>
    discoveredAgentRepository.list();
  const getCommandHistory = (): Command[] => commandHistoryRepository.list();

  const dispatchCommand = createCommandDispatcher({
    deviceRepository,
    commandHistoryRepository,
    connectionRepository,
    pendingAckRepository,
    createCommandId: randomUUID,
    persistState,
  });

  const {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  } = createHttpRequestHandlers({
    deviceRepository,
    discoveredAgentRepository,
    deviceAliasRepository,
    dispatchCommand,
    persistState,
  });

  const handleRequest = (
    request: IncomingMessage,
    response: ServerResponse,
  ): void => {
    void (async () => {
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
        await handleSubmitCommand(request, response);
        return;
      }

      if (request.method === "PATCH" && isNonEmptyString(request.url)) {
        const deviceId = extractDeviceIdFromPatchRoute(request.url);
        if (deviceId) {
          await handleRenameDevice(request, response, deviceId);
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

      if (
        await serveStaticAsset({
          request,
          response,
          staticDir,
        })
      ) {
        return;
      }

      sendJson(response, 404, { message: "Not Found" });
    })().catch(() => {
      if (response.headersSent) {
        response.destroy();
        return;
      }

      sendJson(response, 500, { message: "Internal Server Error" });
    });
  };

  const start = async (): Promise<void> => {
    if (httpServer || webSocketServer) {
      return;
    }

    if (stateFile) {
      const persistedState = loadPersistedServerState(stateFile);
      deviceRepository.clear();
      discoveredAgentRepository.clear();
      deviceAliasRepository.clear();
      commandHistoryRepository.clear();

      for (const persistedDevice of persistedState.devices) {
        deviceRepository.save({
          ...persistedDevice,
          status: "offline",
          capabilities: [...persistedDevice.capabilities],
        });
      }

      deviceAliasRepository.loadFromRecord(persistedState.customDeviceAliases);
      commandHistoryRepository.replaceAll(persistedState.commandHistory);
    }

    const startedRuntime = await startServerRuntime({
      host,
      port,
      handleRequest,
      websocketHandlers: {
        deviceRepository,
        deviceAliasRepository,
        commandHistoryRepository,
        connectionRepository,
        pendingAckRepository,
        presenceService,
        persistState,
      },
      deviceRepository,
      discoveredAgentRepository,
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

    for (const [commandId, pendingAck] of pendingAckRepository.entries()) {
      clearTimeout(pendingAck.timeoutHandle);
      pendingAck.reject(
        new Error(`Server stopped before ack for command ${commandId}.`),
      );
      pendingAckRepository.delete(commandId);
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
