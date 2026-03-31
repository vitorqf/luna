import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import type { WebSocket } from "ws";

export interface DeviceRepository {
  getById: (deviceId: string) => Device | undefined;
  save: (device: Device) => void;
  has: (deviceId: string) => boolean;
  list: () => Device[];
  clear: () => void;
}

export interface DiscoveredAgentRepository {
  getById: (discoveredAgentId: string) => DiscoveredAgent | undefined;
  upsert: (discoveredAgent: DiscoveredAgent) => void;
  removeById: (discoveredAgentId: string) => void;
  list: () => DiscoveredAgent[];
  clear: () => void;
}

export interface DeviceAliasRepository {
  getById: (deviceId: string) => string | undefined;
  set: (deviceId: string, alias: string) => void;
  clear: () => void;
  toRecord: () => Record<string, string>;
  loadFromRecord: (aliases: Record<string, string>) => void;
}

export interface CommandHistoryRepository {
  append: (command: Command) => void;
  list: () => Command[];
  clear: () => void;
  replaceAll: (commands: Command[]) => void;
}

export interface ConnectionRepository {
  getSocketByDeviceId: (deviceId: string) => WebSocket | undefined;
  bind: (deviceId: string, socket: WebSocket) => void;
  unbindIfActive: (deviceId: string, socket: WebSocket) => boolean;
  getDeviceIdBySocket: (socket: WebSocket) => string | undefined;
}

export interface PendingAckRepository<Entry> {
  get: (commandId: string) => Entry | undefined;
  set: (commandId: string, entry: Entry) => void;
  delete: (commandId: string) => void;
  entries: () => IterableIterator<[string, Entry]>;
  clear: () => void;
}
