export const BOOTSTRAP_CONTRACT_VERSION = "v0" as const;

export interface BootstrapContract {
  version: typeof BOOTSTRAP_CONTRACT_VERSION;
}

export type DeviceStatus = "online" | "offline";
export type DeviceCapability =
  | "notify"
  | "open_app"
  | "set_volume"
  | "play_media";

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

export type CommandStatus = "success" | "failed";
export type CommandFailureReason =
  | "invalid_params"
  | "unsupported_intent"
  | "execution_error";

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
