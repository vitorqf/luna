import type { Device, DiscoveredAgent } from "@luna/shared-types";
import type { IncomingMessage, ServerResponse } from "node:http";
import { ApproveDiscoveredAgentUseCase } from "./application/approve-discovered-agent.use-case";
import { RenameDeviceUseCase } from "./application/rename-device.use-case";
import { SubmitCommandUseCase } from "./application/submit-command.use-case";
import type {
  DispatchCommandAcknowledgement,
  DispatchCommandInput,
} from "./command-dispatcher";
import { readRawRequestBody, sendJson } from "./utils/http";
import { isNonEmptyString, isRecord } from "./utils/value";

export interface CreateHttpRequestHandlersInput {
  devices: Map<string, Device>;
  discoveredAgents: Map<string, DiscoveredAgent>;
  customDeviceAliases: Map<string, string>;
  dispatchCommand: (
    input: DispatchCommandInput,
  ) => Promise<DispatchCommandAcknowledgement>;
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
  const submitCommandUseCase = new SubmitCommandUseCase({
    devices,
    dispatchCommand,
  });
  const renameDeviceUseCase = new RenameDeviceUseCase({
    devices,
    customDeviceAliases,
  });
  const approveDiscoveredAgentUseCase = new ApproveDiscoveredAgentUseCase({
    devices,
    discoveredAgents,
  });

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

    const result = await submitCommandUseCase.execute(payload.rawText);
    if (result.kind === "error") {
      sendJson(response, result.statusCode, { message: result.message });
      return;
    }

    sendJson(response, 200, result.acknowledgement);
  };

  const handleRenameDevice = async (
    request: IncomingMessage,
    response: ServerResponse,
    deviceId: string,
  ): Promise<void> => {
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

    const result = renameDeviceUseCase.execute({
      deviceId,
      name: payload.name,
    });
    if (result.kind === "error") {
      sendJson(response, result.statusCode, { message: result.message });
      return;
    }

    sendJson(response, 200, result.device);
  };

  const handleApproveDiscoveredAgent = (
    response: ServerResponse,
    discoveredAgentId: string,
  ): void => {
    const result = approveDiscoveredAgentUseCase.execute(discoveredAgentId);
    if (result.kind === "error") {
      sendJson(response, result.statusCode, { message: result.message });
      return;
    }

    sendJson(response, 200, result.device);
  };

  return {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  };
};
