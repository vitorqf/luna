import type { DeviceCapability } from "@luna/shared-types";

export const protocolBootstrapReady = true;

export const AGENT_REGISTER_MESSAGE_TYPE = "agent.register" as const;
export const AGENT_HEARTBEAT_MESSAGE_TYPE = "agent.heartbeat" as const;
export const COMMAND_DISPATCH_MESSAGE_TYPE = "command.dispatch" as const;
export const COMMAND_ACK_MESSAGE_TYPE = "command.ack" as const;
export const COMMAND_ACK_STATUS_SUCCESS = "success" as const;
export const COMMAND_ACK_STATUS_FAILED = "failed" as const;
export const COMMAND_ACK_REASON_INVALID_PARAMS = "invalid_params" as const;
export const COMMAND_ACK_REASON_UNSUPPORTED_INTENT =
  "unsupported_intent" as const;
export const COMMAND_ACK_REASON_EXECUTION_ERROR = "execution_error" as const;

export type CommandAckFailureReason =
  | typeof COMMAND_ACK_REASON_INVALID_PARAMS
  | typeof COMMAND_ACK_REASON_UNSUPPORTED_INTENT
  | typeof COMMAND_ACK_REASON_EXECUTION_ERROR;

const CANONICAL_DEVICE_CAPABILITIES: readonly DeviceCapability[] = [
  "notify",
  "open_app",
  "set_volume",
  "play_media",
];

export interface AgentRegisterPayload {
  id: string;
  name: string;
  hostname: string;
  capabilities: DeviceCapability[];
}

export interface AgentRegisterMessage {
  type: typeof AGENT_REGISTER_MESSAGE_TYPE;
  payload: AgentRegisterPayload;
}

export interface AgentHeartbeatPayload {
  [key: string]: never;
}

export interface AgentHeartbeatMessage {
  type: typeof AGENT_HEARTBEAT_MESSAGE_TYPE;
  payload: AgentHeartbeatPayload;
}

export interface CommandDispatchPayload {
  commandId: string;
  intent: string;
  params: Record<string, unknown>;
}

export interface CommandDispatchMessage {
  type: typeof COMMAND_DISPATCH_MESSAGE_TYPE;
  payload: CommandDispatchPayload;
}

export type CommandAckPayload =
  | {
      commandId: string;
      status: typeof COMMAND_ACK_STATUS_SUCCESS;
    }
  | {
      commandId: string;
      status: typeof COMMAND_ACK_STATUS_FAILED;
      reason: CommandAckFailureReason;
    };

export interface CommandAckMessage {
  type: typeof COMMAND_ACK_MESSAGE_TYPE;
  payload: CommandAckPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isDeviceCapability = (value: unknown): value is DeviceCapability =>
  typeof value === "string" &&
  (CANONICAL_DEVICE_CAPABILITIES as readonly string[]).includes(value);

export const createAgentRegisterMessage = (
  payload: AgentRegisterPayload
): AgentRegisterMessage => ({
  type: AGENT_REGISTER_MESSAGE_TYPE,
  payload
});

export const createAgentHeartbeatMessage = (
  payload: AgentHeartbeatPayload
): AgentHeartbeatMessage => ({
  type: AGENT_HEARTBEAT_MESSAGE_TYPE,
  payload
});

export const createCommandDispatchMessage = (
  payload: CommandDispatchPayload
): CommandDispatchMessage => ({
  type: COMMAND_DISPATCH_MESSAGE_TYPE,
  payload
});

export const createCommandAckMessage = (
  payload: CommandAckPayload
): CommandAckMessage => ({
  type: COMMAND_ACK_MESSAGE_TYPE,
  payload
});

export const isAgentRegisterMessage = (
  value: unknown
): value is AgentRegisterMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== AGENT_REGISTER_MESSAGE_TYPE) {
    return false;
  }

  if (!isRecord(value.payload)) {
    return false;
  }

  return (
    isNonEmptyString(value.payload.id) &&
    isNonEmptyString(value.payload.name) &&
    isNonEmptyString(value.payload.hostname) &&
    Array.isArray(value.payload.capabilities) &&
    value.payload.capabilities.every(isDeviceCapability)
  );
};

export const isAgentHeartbeatMessage = (
  value: unknown
): value is AgentHeartbeatMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== AGENT_HEARTBEAT_MESSAGE_TYPE) {
    return false;
  }

  if (!isRecord(value.payload)) {
    return false;
  }

  return Object.keys(value.payload).length === 0;
};

export const isCommandDispatchMessage = (
  value: unknown
): value is CommandDispatchMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== COMMAND_DISPATCH_MESSAGE_TYPE) {
    return false;
  }

  if (!isRecord(value.payload)) {
    return false;
  }

  return (
    isNonEmptyString(value.payload.commandId) &&
    isNonEmptyString(value.payload.intent) &&
    isRecord(value.payload.params)
  );
};

export const isCommandAckMessage = (value: unknown): value is CommandAckMessage => {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== COMMAND_ACK_MESSAGE_TYPE) {
    return false;
  }

  if (!isRecord(value.payload)) {
    return false;
  }

  if (!isNonEmptyString(value.payload.commandId)) {
    return false;
  }

  if (value.payload.status === COMMAND_ACK_STATUS_SUCCESS) {
    return !("reason" in value.payload);
  }

  if (value.payload.status === COMMAND_ACK_STATUS_FAILED) {
    return (
      value.payload.reason === COMMAND_ACK_REASON_INVALID_PARAMS ||
      value.payload.reason === COMMAND_ACK_REASON_UNSUPPORTED_INTENT ||
      value.payload.reason === COMMAND_ACK_REASON_EXECUTION_ERROR
    );
  }

  return false;
};

export const parseAgentRegisterMessage = (
  serializedMessage: string
): AgentRegisterMessage | null => {
  try {
    const parsed = JSON.parse(serializedMessage) as unknown;
    return isAgentRegisterMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const parseAgentHeartbeatMessage = (
  serializedMessage: string
): AgentHeartbeatMessage | null => {
  try {
    const parsed = JSON.parse(serializedMessage) as unknown;
    return isAgentHeartbeatMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const parseCommandDispatchMessage = (
  serializedMessage: string
): CommandDispatchMessage | null => {
  try {
    const parsed = JSON.parse(serializedMessage) as unknown;
    return isCommandDispatchMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export const parseCommandAckMessage = (
  serializedMessage: string
): CommandAckMessage | null => {
  try {
    const parsed = JSON.parse(serializedMessage) as unknown;
    return isCommandAckMessage(parsed) ? parsed : null;
  } catch {
    return null;
  }
};
