import {
  createAgentHeartbeatMessage,
  createAgentRegisterMessage,
  createCommandAckMessage,
  parseCommandDispatchMessage
} from "@luna/protocol";
import type { DeviceCapability } from "@luna/shared-types";
import { createDiscoveryAnnouncer } from "./discovery-announcer";
import { dispatchIntentExecution } from "./intent-dispatcher";
import { createNotifyLauncher } from "./notify-launcher";
import { createOpenAppLauncher } from "./open-app-launcher";
import { createPlayMediaLauncher } from "./play-media-launcher";
import { createSetVolumeLauncher } from "./set-volume-launcher";
import { WebSocket } from "ws";

export const agentBootstrapReady = true;

export const SUPPORTED_CAPABILITIES: readonly DeviceCapability[] = [
  "notify",
  "open_app",
  "set_volume",
  "play_media"
];

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
  const socket = new WebSocket(input.serverUrl);
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

  const sendSerializedMessage = async (
    serializedMessage: string
  ): Promise<void> =>
    new Promise<void>((resolve, reject) => {
      socket.send(serializedMessage, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

  await new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      socket.off("error", handleError);
      resolve();
    };

    const handleError = (error: Error) => {
      socket.off("open", handleOpen);
      reject(error);
    };

    socket.once("open", handleOpen);
    socket.once("error", handleError);
  });

  socket.on("message", (rawMessage) => {
    const dispatchMessage = parseCommandDispatchMessage(rawMessage.toString());
    if (!dispatchMessage) {
      return;
    }

    void (async () => {
      const commandId = dispatchMessage.payload.commandId;
      const commandAckPayload = await dispatchIntentExecution({
        commandId,
        intent: dispatchMessage.payload.intent,
        params: dispatchMessage.payload.params,
        executors: {
          executeNotify,
          executeOpenApp,
          executeSetVolume,
          executePlayMedia
        }
      });

      try {
        await input.onCommand?.({
          commandId,
          intent: dispatchMessage.payload.intent,
          params: dispatchMessage.payload.params
        });
      } finally {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        await sendSerializedMessage(
          JSON.stringify(
            createCommandAckMessage(commandAckPayload)
          )
        );
      }
    })().catch(() => undefined);
  });

  await sendSerializedMessage(
    JSON.stringify(
      createAgentRegisterMessage({
        id: input.device.id,
        name: input.device.name,
        hostname: input.device.hostname,
        capabilities: [...registerCapabilities]
      })
    )
  );

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
      if (socket.readyState !== WebSocket.OPEN) {
        return;
      }

      void sendSerializedMessage(
        JSON.stringify(createAgentHeartbeatMessage({}))
      ).catch(() => undefined);
    }, heartbeatIntervalMs);
  }

  socket.on("close", () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = undefined;
    }

    if (discoveryAnnouncer) {
      discoveryAnnouncer.stop();
      discoveryAnnouncer = undefined;
    }
  });

  return {
    disconnect: async () => {
      if (socket.readyState === WebSocket.CLOSED) {
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

      await new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
};
