export type DeviceStatus = "online" | "offline";

export type CommandStatus = "success" | "pending" | "error";

export type DeviceCapability = "notify" | "open_app" | "set_volume" | "play_media" | "screenshot" | "shutdown";

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
