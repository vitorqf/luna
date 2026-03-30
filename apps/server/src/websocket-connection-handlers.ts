import {
  parseAgentHeartbeatMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
} from "@luna/protocol";
import type { Command, Device } from "@luna/shared-types";
import type { WebSocket, WebSocketServer } from "ws";
import {
  settlePendingCommandAck,
  type PendingCommandAck,
} from "./command-dispatcher";
import type { PresenceService } from "./presence-service";
import { normalizeWhitespace } from "./utils/value";

export interface RegisterWebSocketConnectionHandlersInput {
  webSocketServer: WebSocketServer;
  devices: Map<string, Device>;
  customDeviceAliases: Map<string, string>;
  commandHistory: Command[];
  deviceSockets: Map<string, WebSocket>;
  socketDeviceIds: WeakMap<WebSocket, string>;
  pendingCommandAcks: Map<string, PendingCommandAck>;
  presenceService: PresenceService;
  persistState?: (() => void) | undefined;
}

export const registerWebSocketConnectionHandlers = (
  input: RegisterWebSocketConnectionHandlersInput,
): void => {
  const {
    webSocketServer,
    devices,
    customDeviceAliases,
    commandHistory,
    deviceSockets,
    socketDeviceIds,
    pendingCommandAcks,
    presenceService,
    persistState,
  } = input;

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
      presenceService.clearHeartbeatTimeout(deviceId);
      presenceService.markDeviceOffline(deviceId);
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
        const aliasName = customDeviceAliases.get(deviceId);

        devices.set(deviceId, {
          id: deviceId,
          name: aliasName ?? registerName,
          hostname: registerHostname,
          status: "online",
          capabilities: [...registerMessage.payload.capabilities],
        });
        persistState?.();
        deviceSockets.set(deviceId, socket);
        socketDeviceIds.set(socket, deviceId);
        presenceService.armHeartbeatTimeout(deviceId, socket);
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

        presenceService.armHeartbeatTimeout(heartbeatDeviceId, socket);
        return;
      }

      const commandAckMessage = parseCommandAckMessage(serializedMessage);
      if (!commandAckMessage) {
        return;
      }

      settlePendingCommandAck({
        commandAckPayload: commandAckMessage.payload,
        ackDeviceId: socketDeviceIds.get(socket),
        pendingCommandAcks,
        commandHistory,
        persistState,
      });
    });
  });
};
