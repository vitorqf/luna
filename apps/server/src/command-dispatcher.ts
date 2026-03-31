import {
  createCommandDispatchMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import { WebSocket } from "ws";
import type {
  CommandHistoryRepository,
  ConnectionRepository,
  DeviceRepository,
  PendingAckRepository,
} from "./repositories/ports";
import { supportsIntent } from "./utils/device";

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

export interface PendingCommandAck {
  rawText: string;
  intent: string;
  params: Record<string, unknown>;
  targetDeviceId: string;
  timeoutHandle: NodeJS.Timeout;
  resolve: (ack: DispatchCommandAcknowledgement) => void;
  reject: (error: Error) => void;
}

export interface CreateCommandDispatcherInput {
  deviceRepository: DeviceRepository;
  commandHistoryRepository: CommandHistoryRepository;
  connectionRepository: ConnectionRepository;
  pendingAckRepository: PendingAckRepository<PendingCommandAck>;
  createCommandId: () => string;
  persistState?: (() => void) | undefined;
}

export const settlePendingCommandAck = (input: {
  commandAckPayload: CommandAckPayload;
  ackDeviceId: string | undefined;
  pendingAckRepository: PendingAckRepository<PendingCommandAck>;
  commandHistoryRepository: CommandHistoryRepository;
  persistState?: (() => void) | undefined;
}): boolean => {
  const pendingAck = input.pendingAckRepository.get(input.commandAckPayload.commandId);
  if (!pendingAck) {
    return false;
  }

  if (!input.ackDeviceId || input.ackDeviceId !== pendingAck.targetDeviceId) {
    return false;
  }

  input.pendingAckRepository.delete(input.commandAckPayload.commandId);
  clearTimeout(pendingAck.timeoutHandle);
  if (input.commandAckPayload.status === "failed") {
    input.commandHistoryRepository.append({
      id: input.commandAckPayload.commandId,
      rawText: pendingAck.rawText,
      intent: pendingAck.intent,
      targetDeviceId: pendingAck.targetDeviceId,
      params: pendingAck.params,
      status: "failed",
      reason: input.commandAckPayload.reason,
    });
    input.persistState?.();
    pendingAck.resolve({
      commandId: input.commandAckPayload.commandId,
      targetDeviceId: pendingAck.targetDeviceId,
      status: "failed",
      reason: input.commandAckPayload.reason,
    });
    return true;
  }

  input.commandHistoryRepository.append({
    id: input.commandAckPayload.commandId,
    rawText: pendingAck.rawText,
    intent: pendingAck.intent,
    targetDeviceId: pendingAck.targetDeviceId,
    params: pendingAck.params,
    status: "success",
  });
  input.persistState?.();
  pendingAck.resolve({
    commandId: input.commandAckPayload.commandId,
    targetDeviceId: pendingAck.targetDeviceId,
    status: "success",
  });
  return true;
};

export const createCommandDispatcher = (
  input: CreateCommandDispatcherInput,
): ((input: DispatchCommandInput) => Promise<DispatchCommandAcknowledgement>) => {
  const {
    deviceRepository,
    commandHistoryRepository,
    connectionRepository,
    pendingAckRepository,
    createCommandId,
    persistState,
  } = input;

  return async (
    dispatchInput: DispatchCommandInput,
  ): Promise<DispatchCommandAcknowledgement> => {
    const socket = connectionRepository.getSocketByDeviceId(
      dispatchInput.targetDeviceId,
    );
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${dispatchInput.targetDeviceId} is not connected.`);
    }

    const commandId = createCommandId();
    const targetDevice = deviceRepository.getById(dispatchInput.targetDeviceId);
    if (targetDevice && !supportsIntent(targetDevice, dispatchInput.intent)) {
      commandHistoryRepository.append({
        id: commandId,
        rawText: dispatchInput.rawText ?? "",
        intent: dispatchInput.intent,
        targetDeviceId: dispatchInput.targetDeviceId,
        params: dispatchInput.params,
        status: "failed",
        reason: "unsupported_intent",
      });
      persistState?.();

      return {
        commandId,
        targetDeviceId: dispatchInput.targetDeviceId,
        status: "failed",
        reason: "unsupported_intent",
      };
    }

    const serializedDispatchMessage = JSON.stringify(
      createCommandDispatchMessage({
        commandId,
        intent: dispatchInput.intent,
        params: dispatchInput.params,
      }),
    );

    return new Promise<DispatchCommandAcknowledgement>((resolve, reject) => {
      const ackTimeoutMs = dispatchInput.ackTimeoutMs ?? 1_000;
      const timeoutHandle = setTimeout(() => {
        pendingAckRepository.delete(commandId);
        reject(
          new Error(
            `Timed out waiting for ack from device ${dispatchInput.targetDeviceId}.`,
          ),
        );
      }, ackTimeoutMs);

      pendingAckRepository.set(commandId, {
        rawText: dispatchInput.rawText ?? "",
        intent: dispatchInput.intent,
        params: dispatchInput.params,
        targetDeviceId: dispatchInput.targetDeviceId,
        timeoutHandle,
        resolve,
        reject,
      });

      socket.send(serializedDispatchMessage, (error) => {
        if (!error) {
          return;
        }

        clearTimeout(timeoutHandle);
        pendingAckRepository.delete(commandId);
        reject(error);
      });
    });
  };
};
