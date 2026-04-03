import type {
  DeviceCapability as SharedDeviceCapability,
  DeviceStatus as SharedDeviceStatus,
} from "@luna/shared-types";

export type DeviceStatus = SharedDeviceStatus;

export type CommandStatus = "success" | "pending" | "error";

export type DeviceCapability = SharedDeviceCapability;

export interface Device {
  id: string;
  name: string;
  hostname: string;
  type: "notebook" | "desktop" | "server" | "mini_pc";
  status: DeviceStatus;
  capabilities: DeviceCapability[];
  lastSeen?: string;
}

export interface CommandResult {
  id: string;
  command: string;
  targetDevice: string;
  targetDeviceId: string;
  status: CommandStatus;
  message: string;
  timestamp: string;
}

export interface SystemStats {
  totalDevices: number;
  devicesOnline: number;
  commandsExecuted: number;
  recentFailures: number;
}

export interface DiscoveredAgent {
  id: string;
  hostname: string;
  capabilities: DeviceCapability[];
}
