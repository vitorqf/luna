export const BOOTSTRAP_CONTRACT_VERSION = "v0" as const;

export interface BootstrapContract {
  version: typeof BOOTSTRAP_CONTRACT_VERSION;
}

export const OPEN_APP_INTENT = "open_app" as const;
export const NOTIFY_INTENT = "notify" as const;
export const SET_VOLUME_INTENT = "set_volume" as const;
export const PLAY_MEDIA_INTENT = "play_media" as const;

export const DEVICE_STATUSES = ["online", "offline"] as const;
export const DEVICE_CAPABILITIES = [
  "notify",
  "open_app",
  "set_volume",
  "play_media",
] as const;
export const COMMAND_STATUSES = ["success", "failed"] as const;
export const COMMAND_FAILURE_REASONS = [
  "invalid_params",
  "unsupported_intent",
  "execution_error",
] as const;
export const COMMAND_INTENTS = [
  OPEN_APP_INTENT,
  NOTIFY_INTENT,
  SET_VOLUME_INTENT,
  PLAY_MEDIA_INTENT,
] as const;

export type DeviceStatus = (typeof DEVICE_STATUSES)[number];
export type DeviceCapability = (typeof DEVICE_CAPABILITIES)[number];
export type CommandStatus = (typeof COMMAND_STATUSES)[number];
export type CommandFailureReason = (typeof COMMAND_FAILURE_REASONS)[number];
export type CommandIntent = (typeof COMMAND_INTENTS)[number];

const includesLiteral = <Literal extends string>(
  values: readonly Literal[],
  value: unknown,
): value is Literal =>
  typeof value === "string" && values.includes(value as Literal);

export const isDeviceStatus = (value: unknown): value is DeviceStatus =>
  includesLiteral(DEVICE_STATUSES, value);

export const isDeviceCapability = (value: unknown): value is DeviceCapability =>
  includesLiteral(DEVICE_CAPABILITIES, value);

export const isCommandStatus = (value: unknown): value is CommandStatus =>
  includesLiteral(COMMAND_STATUSES, value);

export const isCommandFailureReason = (
  value: unknown,
): value is CommandFailureReason =>
  includesLiteral(COMMAND_FAILURE_REASONS, value);

export const isCommandIntent = (value: unknown): value is CommandIntent =>
  includesLiteral(COMMAND_INTENTS, value);

export interface Device {
  id: string;
  name: string;
  hostname: string;
  status: DeviceStatus;
  capabilities: DeviceCapability[];
}

export interface DiscoveredAgent {
  id: string;
  hostname: string;
  capabilities: DeviceCapability[];
}

export type Command =
  | {
      id: string;
      rawText: string;
      intent: string;
      targetDeviceId: string;
      params: Record<string, unknown>;
      status: "success";
    }
  | {
      id: string;
      rawText: string;
      intent: string;
      targetDeviceId: string;
      params: Record<string, unknown>;
      status: "failed";
      reason: CommandFailureReason;
    };
