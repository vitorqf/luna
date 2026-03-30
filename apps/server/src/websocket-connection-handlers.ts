import {
  parseAgentHeartbeatMessage,
  parseAgentRegisterMessage,
  parseCommandAckMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import type { Command, Device } from "@luna/shared-types";
import type { WebSocket, WebSocketServer } from "ws";
import { normalizeWhitespace } from "./utils/value";

export interface PendingCommandAck {
  rawText: string;
  intent: string;
  params: Record<string, unknown>;
  targetDeviceId: string;
  timeoutHandle: NodeJS.Timeout;
  resolve: (ack: {
    commandId: string;
    targetDeviceId: string;
    status: CommandAckPayload["status"];
    reason?: string;
  }) => void;
  reject: (error: Error) => void;
}

export interface RegisterWebSocketConnectionHandlersInput {
  webSocketServer: WebSocketServer;
  devices: Map<string, Device>;
  customDeviceAliases: Map<string, string>;
  commandHistory: Command[];
  deviceSockets: Map<string, WebSocket>;
  socketDeviceIds: WeakMap<WebSocket, string>;
  pendingCommandAcks: Map<string, PendingCommandAck>;
  clearHeartbeatTimeout: (deviceId: string) => void;
  markDeviceOffline: (deviceId: string) => void;
  armHeartbeatTimeout: (deviceId: string, socket: WebSocket) => void;
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
    clearHeartbeatTimeout,
    markDeviceOffline,
    armHeartbeatTimeout,
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
      clearHeartbeatTimeout(deviceId);
      markDeviceOffline(deviceId);
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

      const pendingAck = pendingCommandAcks.get(commandAckMessage.payload.commandId);
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
};
