export const protocolBootstrapReady = true;

export const AGENT_REGISTER_MESSAGE_TYPE = "agent.register" as const;
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

export interface AgentRegisterPayload {
  id: string;
  name: string;
  hostname: string;
}

export interface AgentRegisterMessage {
  type: typeof AGENT_REGISTER_MESSAGE_TYPE;
  payload: AgentRegisterPayload;
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

export const createAgentRegisterMessage = (
  payload: AgentRegisterPayload
): AgentRegisterMessage => ({
  type: AGENT_REGISTER_MESSAGE_TYPE,
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
    isNonEmptyString(value.payload.hostname)
  );
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
