import type { Device, CommandResult, SystemStats } from "./types";

export const mockDevices: Device[] = [
  {
    id: "dev-001",
    name: "Notebook 2",
    hostname: "notebook-2.local",
    type: "notebook",
    status: "online",
    capabilities: ["notify", "open_app", "set_volume", "play_media"],
    lastSeen: "now",
  },
  {
    id: "dev-002",
    name: "Desktop Sala",
    hostname: "desktop-sala.local",
    type: "desktop",
    status: "offline",
    capabilities: ["notify", "open_app", "set_volume", "screenshot", "shutdown"],
    lastSeen: "2 hours ago",
  },
  {
    id: "dev-003",
    name: "Mini PC Homelab",
    hostname: "mini-pc-homelab.local",
    type: "mini_pc",
    status: "online",
    capabilities: ["notify", "shutdown"],
    lastSeen: "now",
  },
  {
    id: "dev-004",
    name: "Server Principal",
    hostname: "server-principal.local",
    type: "server",
    status: "online",
    capabilities: ["notify", "shutdown"],
    lastSeen: "now",
  },
];

export const mockCommandHistory: CommandResult[] = [
  {
    id: "cmd-001",
    command: "Abra o Spotify no Notebook 2",
    targetDevice: "Notebook 2",
    targetDeviceId: "dev-001",
    status: "success",
    message: "Spotify opened successfully",
    timestamp: "2 min ago",
  },
  {
    id: "cmd-002",
    command: 'Tocar "lo-fi" no Notebook 2',
    targetDevice: "Notebook 2",
    targetDeviceId: "dev-001",
    status: "success",
    message: "Playing lo-fi playlist",
    timestamp: "5 min ago",
  },
  {
    id: "cmd-003",
    command: "Mostre uma notificacao no Desktop Sala",
    targetDevice: "Desktop Sala",
    targetDeviceId: "dev-002",
    status: "error",
    message: "Device offline",
    timestamp: "12 min ago",
  },
  {
    id: "cmd-004",
    command: "Aumente o volume do Notebook 2 para 50%",
    targetDevice: "Notebook 2",
    targetDeviceId: "dev-001",
    status: "success",
    message: "Volume set to 50%",
    timestamp: "18 min ago",
  },
  {
    id: "cmd-005",
    command: "Restart Mini PC Homelab",
    targetDevice: "Mini PC Homelab",
    targetDeviceId: "dev-003",
    status: "success",
    message: "Restart initiated",
    timestamp: "1 hour ago",
  },
];

export const mockSystemStats: SystemStats = {
  totalDevices: 4,
  devicesOnline: 3,
  commandsExecuted: 127,
  recentFailures: 2,
};

export const commandPlaceholders = [
  "Abra o Spotify no Notebook 2",
  'Tocar "lo-fi" no Notebook 2',
  "Definir volume para 50% no Notebook 2",
  'Notificar "Backup concluido" no Mini PC Homelab',
  "Desligue o Desktop Sala",
];

