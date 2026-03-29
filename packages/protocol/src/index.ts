export const protocolBootstrapReady = true;

export const AGENT_REGISTER_MESSAGE_TYPE = "agent.register" as const;

export interface AgentRegisterPayload {
  id: string;
  name: string;
  hostname: string;
}

export interface AgentRegisterMessage {
  type: typeof AGENT_REGISTER_MESSAGE_TYPE;
  payload: AgentRegisterPayload;
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
