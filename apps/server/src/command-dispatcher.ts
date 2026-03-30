import {
  createCommandDispatchMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import type { Command, Device } from "@luna/shared-types";
import { WebSocket } from "ws";
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
  devices: Map<string, Device>;
  commandHistory: Command[];
  deviceSockets: Map<string, WebSocket>;
  pendingCommandAcks: Map<string, PendingCommandAck>;
  createCommandId: () => string;
}

export const settlePendingCommandAck = (input: {
  commandAckPayload: CommandAckPayload;
  ackDeviceId: string | undefined;
  pendingCommandAcks: Map<string, PendingCommandAck>;
  commandHistory: Command[];
}): boolean => {
  const pendingAck = input.pendingCommandAcks.get(input.commandAckPayload.commandId);
  if (!pendingAck) {
    return false;
  }

  if (!input.ackDeviceId || input.ackDeviceId !== pendingAck.targetDeviceId) {
    return false;
  }

  input.pendingCommandAcks.delete(input.commandAckPayload.commandId);
  clearTimeout(pendingAck.timeoutHandle);
  if (input.commandAckPayload.status === "failed") {
    input.commandHistory.push({
      id: input.commandAckPayload.commandId,
      rawText: pendingAck.rawText,
      intent: pendingAck.intent,
      targetDeviceId: pendingAck.targetDeviceId,
      params: pendingAck.params,
      status: "failed",
      reason: input.commandAckPayload.reason,
    });
    pendingAck.resolve({
      commandId: input.commandAckPayload.commandId,
      targetDeviceId: pendingAck.targetDeviceId,
      status: "failed",
      reason: input.commandAckPayload.reason,
    });
    return true;
  }

  input.commandHistory.push({
    id: input.commandAckPayload.commandId,
    rawText: pendingAck.rawText,
    intent: pendingAck.intent,
    targetDeviceId: pendingAck.targetDeviceId,
    params: pendingAck.params,
    status: "success",
  });
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
  const { devices, commandHistory, deviceSockets, pendingCommandAcks, createCommandId } =
    input;

  return async (
    dispatchInput: DispatchCommandInput,
  ): Promise<DispatchCommandAcknowledgement> => {
    const socket = deviceSockets.get(dispatchInput.targetDeviceId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error(`Device ${dispatchInput.targetDeviceId} is not connected.`);
    }

    const commandId = createCommandId();
    const targetDevice = devices.get(dispatchInput.targetDeviceId);
    if (targetDevice && !supportsIntent(targetDevice, dispatchInput.intent)) {
      commandHistory.push({
        id: commandId,
        rawText: dispatchInput.rawText ?? "",
        intent: dispatchInput.intent,
        targetDeviceId: dispatchInput.targetDeviceId,
        params: dispatchInput.params,
        status: "failed",
        reason: "unsupported_intent",
      });

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
        pendingCommandAcks.delete(commandId);
        reject(
          new Error(
            `Timed out waiting for ack from device ${dispatchInput.targetDeviceId}.`,
          ),
        );
      }, ackTimeoutMs);

      pendingCommandAcks.set(commandId, {
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
        pendingCommandAcks.delete(commandId);
        reject(error);
      });
    });
  };
};
