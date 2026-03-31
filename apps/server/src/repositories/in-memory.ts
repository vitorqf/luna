import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import type { WebSocket } from "ws";
import type {
  CommandHistoryRepository,
  ConnectionRepository,
  DeviceAliasRepository,
  DeviceRepository,
  DiscoveredAgentRepository,
  PendingAckRepository,
} from "./ports";

export const createInMemoryDeviceRepository = (): DeviceRepository => {
  const devices = new Map<string, Device>();

  return {
    getById: (deviceId) => devices.get(deviceId),
    save: (device) => {
      devices.set(device.id, device);
    },
    has: (deviceId) => devices.has(deviceId),
    list: () => Array.from(devices.values()),
    clear: () => {
      devices.clear();
    },
  };
};

export const createInMemoryDiscoveredAgentRepository =
  (): DiscoveredAgentRepository => {
    const discoveredAgents = new Map<string, DiscoveredAgent>();

    return {
      getById: (discoveredAgentId) => discoveredAgents.get(discoveredAgentId),
      upsert: (discoveredAgent) => {
        discoveredAgents.set(discoveredAgent.id, discoveredAgent);
      },
      removeById: (discoveredAgentId) => {
        discoveredAgents.delete(discoveredAgentId);
      },
      list: () => Array.from(discoveredAgents.values()),
      clear: () => {
        discoveredAgents.clear();
      },
    };
  };

export const createInMemoryDeviceAliasRepository = (): DeviceAliasRepository => {
  const aliases = new Map<string, string>();

  return {
    getById: (deviceId) => aliases.get(deviceId),
    set: (deviceId, alias) => {
      aliases.set(deviceId, alias);
    },
    clear: () => {
      aliases.clear();
    },
    toRecord: () => Object.fromEntries(aliases),
    loadFromRecord: (inputAliases) => {
      aliases.clear();
      for (const [deviceId, alias] of Object.entries(inputAliases)) {
        aliases.set(deviceId, alias);
      }
    },
  };
};

export const createInMemoryCommandHistoryRepository =
  (): CommandHistoryRepository => {
    const history: Command[] = [];

    return {
      append: (command) => {
        history.push(command);
      },
      list: () => [...history],
      clear: () => {
        history.length = 0;
      },
      replaceAll: (commands) => {
        history.length = 0;
        history.push(...commands);
      },
    };
  };

export const createInMemoryConnectionRepository = (): ConnectionRepository => {
  const deviceSockets = new Map<string, WebSocket>();
  const socketDeviceIds = new WeakMap<WebSocket, string>();

  return {
    getSocketByDeviceId: (deviceId) => deviceSockets.get(deviceId),
    bind: (deviceId, socket) => {
      deviceSockets.set(deviceId, socket);
      socketDeviceIds.set(socket, deviceId);
    },
    unbindIfActive: (deviceId, socket) => {
      if (deviceSockets.get(deviceId) !== socket) {
        return false;
      }

      deviceSockets.delete(deviceId);
      return true;
    },
    getDeviceIdBySocket: (socket) => socketDeviceIds.get(socket),
  };
};

export const createInMemoryPendingAckRepository = <Entry>(): PendingAckRepository<Entry> => {
  const pendingAcks = new Map<string, Entry>();

  return {
    get: (commandId) => pendingAcks.get(commandId),
    set: (commandId, entry) => {
      pendingAcks.set(commandId, entry);
    },
    delete: (commandId) => {
      pendingAcks.delete(commandId);
    },
    entries: () => pendingAcks.entries(),
    clear: () => {
      pendingAcks.clear();
    },
  };
};
