import {
  parseAgentHeartbeatMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
} from "@luna/protocol";
import type { WebSocket, WebSocketServer } from "ws";
import {
  settlePendingCommandAck,
  type PendingCommandAck,
} from "./command-dispatcher";
import type { PresenceService } from "./presence-service";
import type {
  CommandHistoryRepository,
  ConnectionRepository,
  DeviceAliasRepository,
  DeviceRepository,
  PendingAckRepository,
} from "./repositories/ports";
import { normalizeWhitespace } from "./utils/value";

export interface RegisterWebSocketConnectionHandlersInput {
  webSocketServer: WebSocketServer;
  deviceRepository: DeviceRepository;
  deviceAliasRepository: DeviceAliasRepository;
  commandHistoryRepository: CommandHistoryRepository;
  connectionRepository: ConnectionRepository;
  pendingAckRepository: PendingAckRepository<PendingCommandAck>;
  presenceService: PresenceService;
  persistState?: (() => void) | undefined;
}

export const registerWebSocketConnectionHandlers = (
  input: RegisterWebSocketConnectionHandlersInput,
): void => {
  const {
    webSocketServer,
    deviceRepository,
    deviceAliasRepository,
    commandHistoryRepository,
    connectionRepository,
    pendingAckRepository,
    presenceService,
    persistState,
  } = input;

  webSocketServer.on("connection", (socket) => {
    socket.on("close", () => {
      const deviceId = connectionRepository.getDeviceIdBySocket(socket);
      if (!deviceId) {
        return;
      }

      const isActiveSocket = connectionRepository.unbindIfActive(deviceId, socket);
      if (isActiveSocket) {
        presenceService.clearHeartbeatTimeout(deviceId);
      }
      presenceService.markDeviceOfflineFromSocketClose(deviceId, isActiveSocket);
    });

    socket.on("message", (rawMessage) => {
      const serializedMessage = rawMessage.toString();
      const registerMessage = parseAgentRegisterMessage(serializedMessage);
      if (registerMessage) {
        const deviceId = normalizeWhitespace(registerMessage.payload.id);
        const registerName = normalizeWhitespace(registerMessage.payload.name);
        const registerHostname = normalizeWhitespace(
          registerMessage.payload.hostname,
        );
        const aliasName = deviceAliasRepository.getById(deviceId);

        deviceRepository.save({
          id: deviceId,
          name: aliasName ?? registerName,
          hostname: registerHostname,
          status: "online",
          capabilities: [...registerMessage.payload.capabilities],
        });
        presenceService.markDeviceOnlineOnRegister(deviceId);
        persistState?.();
        connectionRepository.bind(deviceId, socket);
        presenceService.armHeartbeatTimeout(deviceId, socket);
        return;
      }

      const heartbeatMessage = parseAgentHeartbeatMessage(serializedMessage);
      if (heartbeatMessage) {
        const heartbeatDeviceId = connectionRepository.getDeviceIdBySocket(socket);
        if (!heartbeatDeviceId) {
          return;
        }

        const isActiveSocket =
          connectionRepository.getSocketByDeviceId(heartbeatDeviceId) === socket;
        presenceService.onHeartbeat(heartbeatDeviceId, isActiveSocket, socket);
        return;
      }

      const commandAckMessage = parseCommandAckMessage(serializedMessage);
      if (!commandAckMessage) {
        return;
      }

      settlePendingCommandAck({
        commandAckPayload: commandAckMessage.payload,
        ackDeviceId: connectionRepository.getDeviceIdBySocket(socket),
        pendingAckRepository,
        commandHistoryRepository,
        persistState,
      });
    });
  });
};
