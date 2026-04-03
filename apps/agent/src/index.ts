import {
  DEVICE_CAPABILITIES,
  type DeviceCapability,
} from "@luna/shared-types";
import { createAgentOperationalLifecycle } from "./agent-operational-lifecycle";
import { createAgentSession } from "./agent-session";
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
  const lifecycle = createAgentOperationalLifecycle({
    session,
    serverUrl: input.serverUrl,
    device: {
      id: input.device.id,
      hostname: input.device.hostname,
      capabilities: [...registerCapabilities],
    },
    heartbeatIntervalMs,
    discoveryIntervalMs,
    ...(input.onDisconnect ? { onDisconnect: input.onDisconnect } : {}),
  });

  return {
    disconnect: () => lifecycle.disconnect(),
  };
};
