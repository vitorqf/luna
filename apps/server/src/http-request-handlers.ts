import type { Device, DiscoveredAgent } from "@luna/shared-types";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ApproveDiscoveredAgentUseCase,
  type ApproveDiscoveredAgentUseCaseErrorCode,
} from "./application/approve-discovered-agent.use-case";
import type {
  CommandDispatchPort,
  DeviceWritePort,
  DiscoveredAgentPort,
  TargetDeviceLookupPort,
} from "./application/ports";
import {
  RenameDeviceUseCase,
  type RenameDeviceUseCaseErrorCode,
} from "./application/rename-device.use-case";
import {
  SubmitCommandUseCase,
  type SubmitCommandUseCaseErrorCode,
} from "./application/submit-command.use-case";
import type {
  DispatchCommandAcknowledgement,
  DispatchCommandInput,
} from "./command-dispatcher";
import { isDeviceNameTaken, resolveDeviceByTarget } from "./utils/device";
import { readRawRequestBody, sendJson } from "./utils/http";
import { isNonEmptyString, isRecord } from "./utils/value";

export interface CreateHttpRequestHandlersInput {
  devices: Map<string, Device>;
  discoveredAgents: Map<string, DiscoveredAgent>;
  customDeviceAliases: Map<string, string>;
  dispatchCommand: (
    input: DispatchCommandInput,
  ) => Promise<DispatchCommandAcknowledgement>;
  persistState?: (() => void) | undefined;
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
  const {
    devices,
    discoveredAgents,
    customDeviceAliases,
    dispatchCommand,
    persistState,
  } = input;
  const targetDeviceLookupPort: TargetDeviceLookupPort = {
    resolveByTargetName: (targetName) =>
      resolveDeviceByTarget(devices.values(), targetName),
  };
  const commandDispatchPort: CommandDispatchPort = {
    dispatch: (dispatchInput) => dispatchCommand(dispatchInput),
  };
  const deviceWritePort: DeviceWritePort = {
    getById: (deviceId) => devices.get(deviceId),
    save: (device) => {
      devices.set(device.id, device);
      persistState?.();
    },
    isNameTaken: (candidateName, excludedDeviceId) =>
      isDeviceNameTaken(devices.values(), candidateName, excludedDeviceId),
    setAlias: (deviceId, alias) => {
      customDeviceAliases.set(deviceId, alias);
    },
  };
  const discoveredAgentPort: DiscoveredAgentPort = {
    getById: (discoveredAgentId) => discoveredAgents.get(discoveredAgentId),
    removeById: (discoveredAgentId) => {
      discoveredAgents.delete(discoveredAgentId);
    },
  };
  const submitCommandUseCase = new SubmitCommandUseCase({
    targetDeviceLookupPort,
    commandDispatchPort,
  });
  const renameDeviceUseCase = new RenameDeviceUseCase({
    deviceWritePort,
  });
  const approveDiscoveredAgentUseCase = new ApproveDiscoveredAgentUseCase({
    deviceWritePort,
    discoveredAgentPort,
  });

  const mapSubmitCommandErrorToHttp = (
    code: SubmitCommandUseCaseErrorCode,
  ): { statusCode: 422 | 404 | 500; message: string } => {
    switch (code) {
      case "parse_failed":
        return {
          statusCode: 422,
          message: "Unable to parse command.",
        };
      case "target_not_found":
        return {
          statusCode: 404,
          message: "Target device is not registered.",
        };
      case "dispatch_failed":
        return {
          statusCode: 500,
          message: "Failed to dispatch command.",
        };
    }
  };

  const mapRenameDeviceErrorToHttp = (
    code: RenameDeviceUseCaseErrorCode,
  ): { statusCode: 400 | 404 | 409; message: string } => {
    switch (code) {
      case "device_not_found":
        return {
          statusCode: 404,
          message: "Device not found.",
        };
      case "name_required":
        return {
          statusCode: 400,
          message: "name is required.",
        };
      case "name_taken":
        return {
          statusCode: 409,
          message: "Device name is already in use.",
        };
    }
  };

  const mapApproveDiscoveredAgentErrorToHttp = (
    code: ApproveDiscoveredAgentUseCaseErrorCode,
  ): { statusCode: 404 | 409; message: string } => {
    switch (code) {
      case "discovered_agent_not_found":
        return {
          statusCode: 404,
          message: "Discovered agent not found.",
        };
      case "name_taken":
        return {
          statusCode: 409,
          message: "Device name is already in use.",
        };
    }
  };

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
      const httpError = mapSubmitCommandErrorToHttp(result.error.code);
      sendJson(response, httpError.statusCode, { message: httpError.message });
      return;
    }

    sendJson(response, 200, result.data);
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
      const httpError = mapRenameDeviceErrorToHttp(result.error.code);
      sendJson(response, httpError.statusCode, { message: httpError.message });
      return;
    }

    sendJson(response, 200, result.data);
  };

  const handleApproveDiscoveredAgent = (
    response: ServerResponse,
    discoveredAgentId: string,
  ): void => {
    const result = approveDiscoveredAgentUseCase.execute(discoveredAgentId);
    if (result.kind === "error") {
      const httpError = mapApproveDiscoveredAgentErrorToHttp(result.error.code);
      sendJson(response, httpError.statusCode, { message: httpError.message });
      return;
    }

    sendJson(response, 200, result.data);
  };

  return {
    handleSubmitCommand,
    handleRenameDevice,
    handleApproveDiscoveredAgent,
  };
};
