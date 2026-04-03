import {
  createAgentHeartbeatMessage
} from "@luna/protocol";
import {
  DEVICE_CAPABILITIES,
  type DeviceCapability,
} from "@luna/shared-types";
import { createAgentSession } from "./agent-session";
import { createDiscoveryAnnouncer } from "./discovery-announcer";
import { createNotifyLauncher } from "./notify-launcher";
import { createOpenAppLauncher } from "./open-app-launcher";
import { createPlayMediaLauncher } from "./play-media-launcher";
import { createSetVolumeLauncher } from "./set-volume-launcher";

export const agentBootstrapReady = true;

export const SUPPORTED_CAPABILITIES = DEVICE_CAPABILITIES;

export interface AgentIdentity {
  id: string;
  name: string;
  hostname: string;
  capabilities?: DeviceCapability[];
}

export interface ConnectAgentInput {
  serverUrl: string;
  device: AgentIdentity;
  heartbeatIntervalMs?: number;
  discoveryIntervalMs?: number;
  onDisconnect?: () => void;
  onCommand?: (command: ReceivedCommand) => void | Promise<void>;
  executeNotify?: (
    notification: LocalNotification
  ) => void | Promise<void>;
  executeOpenApp?: (
    openApp: LocalOpenApp
  ) => void | Promise<void>;
  executeSetVolume?: (
    setVolume: LocalSetVolume
  ) => void | Promise<void>;
  executePlayMedia?: (
    playMedia: LocalPlayMedia
  ) => void | Promise<void>;
}

export interface AgentConnection {
  disconnect: () => Promise<void>;
}

export interface ReceivedCommand {
  commandId: string;
  intent: string;
  params: Record<string, unknown>;
}

export interface LocalNotification {
  title: string;
  message: string;
}

export interface LocalOpenApp {
  appName: string;
}

export interface LocalSetVolume {
  volumePercent: number;
}

export interface LocalPlayMedia {
  mediaQuery: string;
}

const launchNotify = createNotifyLauncher();
const executeLocalNotify = async (
  notification: LocalNotification
): Promise<void> => launchNotify(notification);

const launchOpenApp = createOpenAppLauncher();

const executeLocalOpenApp = async (openApp: LocalOpenApp): Promise<void> =>
  launchOpenApp(openApp);

const launchSetVolume = createSetVolumeLauncher();
const executeLocalSetVolume = async (
  setVolume: LocalSetVolume
): Promise<void> => launchSetVolume(setVolume);

const launchPlayMedia = createPlayMediaLauncher();
const executeLocalPlayMedia = async (
  playMedia: LocalPlayMedia
): Promise<void> => launchPlayMedia(playMedia);

const startDiscoveryAnnouncer = createDiscoveryAnnouncer();

const getErrorReason = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown launcher error.";
};

export const connectAgent = async (
  input: ConnectAgentInput
): Promise<AgentConnection> => {
  const registerCapabilities =
    input.device.capabilities ?? SUPPORTED_CAPABILITIES;
  const heartbeatIntervalMs = input.heartbeatIntervalMs ?? 5_000;
  const discoveryIntervalMs = input.discoveryIntervalMs ?? 5_000;
  const executeNotify = input.executeNotify ?? executeLocalNotify;
  const executeOpenApp = input.executeOpenApp ?? executeLocalOpenApp;
  const executeSetVolume = input.executeSetVolume ?? executeLocalSetVolume;
  const executePlayMedia = input.executePlayMedia ?? executeLocalPlayMedia;
  let heartbeatInterval: NodeJS.Timeout | undefined;
  let discoveryAnnouncer:
    | {
        stop: () => void;
      }
    | undefined;
  const session = await createAgentSession({
    serverUrl: input.serverUrl,
    device: {
      id: input.device.id,
      name: input.device.name,
      hostname: input.device.hostname,
      capabilities: [...registerCapabilities]
    },
    executors: {
      executeNotify,
      executeOpenApp,
      executeSetVolume,
      executePlayMedia
    },
    ...(input.onCommand ? { onCommand: input.onCommand } : {})
  });

  try {
    discoveryAnnouncer = startDiscoveryAnnouncer({
      serverUrl: input.serverUrl,
      device: {
        id: input.device.id,
        hostname: input.device.hostname,
        capabilities: [...registerCapabilities]
      },
      intervalMs: discoveryIntervalMs
    });
  } catch (error) {
    console.error("[luna][discovery][error]", {
      deviceId: input.device.id,
      reason: getErrorReason(error)
    });
  }

  if (heartbeatIntervalMs > 0) {
    heartbeatInterval = setInterval(() => {
      if (!session.isOpen()) {
        return;
      }

      void session.sendSerializedMessage(
        JSON.stringify(createAgentHeartbeatMessage({}))
      ).catch(() => undefined);
    }, heartbeatIntervalMs);
  }

  session.onClose(() => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
    }

    if (discoveryAnnouncer) {
      discoveryAnnouncer.stop();
      discoveryAnnouncer = undefined;
    }

    input.onDisconnect?.();
  });

  return {
    disconnect: async () => {
      if (!session.isOpen()) {
        return;
      }

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = undefined;
      }

      if (discoveryAnnouncer) {
        discoveryAnnouncer.stop();
        discoveryAnnouncer = undefined;
      }

      await session.disconnect();
    }
  };
};
