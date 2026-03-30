import { parseCommand } from "@luna/command-parser";
import type { Device, DiscoveredAgent } from "@luna/shared-types";
import type { IncomingMessage, ServerResponse } from "node:http";
import { isDeviceNameTaken, resolveDeviceByTarget } from "./utils/device";
import { readRawRequestBody, sendJson } from "./utils/http";
import { isNonEmptyString, isRecord, normalizeWhitespace } from "./utils/value";

export interface SubmitDispatchCommandInput {
  rawText?: string;
  targetDeviceId: string;
  intent: string;
  params: Record<string, unknown>;
  ackTimeoutMs?: number;
}

export interface SubmitDispatchCommandAcknowledgement {
  commandId: string;
  targetDeviceId: string;
  status: "success" | "failed";
  reason?: string;
}

export interface CreateHttpRequestHandlersInput {
  devices: Map<string, Device>;
  discoveredAgents: Map<string, DiscoveredAgent>;
  customDeviceAliases: Map<string, string>;
  dispatchCommand: (
    input: SubmitDispatchCommandInput,
  ) => Promise<SubmitDispatchCommandAcknowledgement>;
}

export interface HttpRequestHandlers {
  handleSubmitCommand: (
    request: IncomingMessage,
    response: ServerResponse,
  ) => Promise<void>;
  handleRenameDevice: (
    request: IncomingMessage,
    response: ServerResponse,
    deviceId: string,
  ) => Promise<void>;
  handleApproveDiscoveredAgent: (
    response: ServerResponse,
    discoveredAgentId: string,
  ) => void;
}

export const createHttpRequestHandlers = (
  input: CreateHttpRequestHandlersInput,
): HttpRequestHandlers => {
  const { devices, discoveredAgents, customDeviceAliases, dispatchCommand } = input;

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

    const targetDevice = resolveDeviceByTarget(
      devices.values(),
      parsedCommand.targetDeviceName,
    );
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

  const handleRenameDevice = async (
    request: IncomingMessage,
    response: ServerResponse,
    deviceId: string,
  ): Promise<void> => {
    const currentDevice = devices.get(deviceId);
    if (!currentDevice) {
      sendJson(response, 404, { message: "Device not found." });
      return;
    }

    let payload: unknown;

    try {
      const rawBody = await readRawRequestBody(request);
      payload = JSON.parse(rawBody);
    } catch {
      sendJson(response, 400, { message: "Invalid JSON body." });
      return;
    }

    if (!isRecord(payload) || !isNonEmptyString(payload.name)) {
      sendJson(response, 400, { message: "name is required." });
      return;
    }

    const normalizedName = normalizeWhitespace(payload.name);
    if (!normalizedName) {
      sendJson(response, 400, { message: "name is required." });
      return;
    }

    if (isDeviceNameTaken(devices.values(), normalizedName, deviceId)) {
      sendJson(response, 409, { message: "Device name is already in use." });
      return;
    }

    customDeviceAliases.set(deviceId, normalizedName);

    const updatedDevice: Device = {
      ...currentDevice,
      name: normalizedName,
    };
    devices.set(deviceId, updatedDevice);

    sendJson(response, 200, updatedDevice);
  };

  const handleApproveDiscoveredAgent = (
    response: ServerResponse,
    discoveredAgentId: string,
  ): void => {
    const normalizedDiscoveredAgentId = normalizeWhitespace(discoveredAgentId);
    const discoveredAgent = discoveredAgents.get(normalizedDiscoveredAgentId);
    if (!discoveredAgent) {
      sendJson(response, 404, { message: "Discovered agent not found." });
      return;
    }

    const existingDevice = devices.get(normalizedDiscoveredAgentId);
    if (existingDevice) {
      discoveredAgents.delete(normalizedDiscoveredAgentId);
      sendJson(response, 200, existingDevice);
      return;
    }

    const approvedName = normalizeWhitespace(discoveredAgent.hostname);
    if (
      isDeviceNameTaken(
        devices.values(),
        approvedName,
        normalizedDiscoveredAgentId,
      )
    ) {
      sendJson(response, 409, { message: "Device name is already in use." });
      return;
    }

    const approvedDevice: Device = {
      id: normalizedDiscoveredAgentId,
      name: approvedName,
      hostname: normalizeWhitespace(discoveredAgent.hostname),
      status: "offline",
      capabilities: [...discoveredAgent.capabilities],
    };

    devices.set(normalizedDiscoveredAgentId, approvedDevice);
    discoveredAgents.delete(normalizedDiscoveredAgentId);
    sendJson(response, 200, approvedDevice);
  };

  return {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  };
};
