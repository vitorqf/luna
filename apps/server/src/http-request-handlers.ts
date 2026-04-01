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
import type {
  DeviceAliasRepository,
  DeviceRepository,
  DiscoveredAgentRepository,
} from "./repositories/ports";
import { isDeviceNameTaken, resolveDeviceByTarget } from "./utils/device";
import { readRawRequestBody, sendJson } from "./utils/http";
import { isNonEmptyString, isRecord } from "./utils/value";

const INVALID_JSON_BODY_MESSAGE = "Invalid JSON body.";

interface SubmitCommandHttpBody {
  rawText: string;
}

interface RenameDeviceHttpBody {
  name: string;
}

type RequestBodyValidationResult<Body> =
  | { kind: "ok"; body: Body }
  | { kind: "error"; message: string };

type RequestBodyValidator<Body> = (
  payload: unknown,
) => RequestBodyValidationResult<Body>;

const validateSubmitBody: RequestBodyValidator<SubmitCommandHttpBody> = (
  payload,
) => {
  if (!isRecord(payload) || !isNonEmptyString(payload.rawText)) {
    return {
      kind: "error",
      message: "rawText is required.",
    };
  }

  return {
    kind: "ok",
    body: {
      rawText: payload.rawText,
    },
  };
};

const validateRenameBody: RequestBodyValidator<RenameDeviceHttpBody> = (
  payload,
) => {
  if (!isRecord(payload) || !isNonEmptyString(payload.name)) {
    return {
      kind: "error",
      message: "name is required.",
    };
  }

  return {
    kind: "ok",
    body: {
      name: payload.name,
    },
  };
};

const parseAndValidateRequestBody = async <Body>(
  request: IncomingMessage,
  validateBody: RequestBodyValidator<Body>,
): Promise<RequestBodyValidationResult<Body>> => {
  let payload: unknown;

  try {
    const rawBody = await readRawRequestBody(request);
    payload = JSON.parse(rawBody);
  } catch {
    return {
      kind: "error",
      message: INVALID_JSON_BODY_MESSAGE,
    };
  }

  return validateBody(payload);
};

export interface CreateHttpRequestHandlersInput {
  deviceRepository: DeviceRepository;
  discoveredAgentRepository: DiscoveredAgentRepository;
  deviceAliasRepository: DeviceAliasRepository;
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
    deviceRepository,
    discoveredAgentRepository,
    deviceAliasRepository,
    dispatchCommand,
    persistState,
  } = input;
  const targetDeviceLookupPort: TargetDeviceLookupPort = {
    resolveByTargetName: (targetName) =>
      resolveDeviceByTarget(deviceRepository.list(), targetName),
  };
  const commandDispatchPort: CommandDispatchPort = {
    dispatch: (dispatchInput) => dispatchCommand(dispatchInput),
  };
  const deviceWritePort: DeviceWritePort = {
    getById: (deviceId) => deviceRepository.getById(deviceId),
    save: (device) => {
      deviceRepository.save(device);
      persistState?.();
    },
    isNameTaken: (candidateName, excludedDeviceId) =>
      isDeviceNameTaken(deviceRepository.list(), candidateName, excludedDeviceId),
    setAlias: (deviceId, alias) => {
      deviceAliasRepository.set(deviceId, alias);
    },
  };
  const discoveredAgentPort: DiscoveredAgentPort = {
    getById: (discoveredAgentId) => discoveredAgentRepository.getById(discoveredAgentId),
    removeById: (discoveredAgentId) => {
      discoveredAgentRepository.removeById(discoveredAgentId);
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
    const bodyResult = await parseAndValidateRequestBody(request, validateSubmitBody);
    if (bodyResult.kind === "error") {
      sendJson(response, 400, { message: bodyResult.message });
      return;
    }

    const result = await submitCommandUseCase.execute(bodyResult.body.rawText);
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
    const bodyResult = await parseAndValidateRequestBody(request, validateRenameBody);
    if (bodyResult.kind === "error") {
      sendJson(response, 400, { message: bodyResult.message });
      return;
    }

    const result = renameDeviceUseCase.execute({
      deviceId,
      name: bodyResult.body.name,
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
