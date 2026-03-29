export const BOOTSTRAP_CONTRACT_VERSION = "v0" as const;

export interface BootstrapContract {
  version: typeof BOOTSTRAP_CONTRACT_VERSION;
}

export type DeviceStatus = "online" | "offline";

export interface Device {
  id: string;
  name: string;
  hostname: string;
  status: DeviceStatus;
}
