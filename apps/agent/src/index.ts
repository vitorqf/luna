import {
  COMMAND_ACK_STATUS_FAILED,
  COMMAND_ACK_STATUS_SUCCESS,
  createAgentHeartbeatMessage,
  createAgentRegisterMessage,
  createCommandAckMessage,
  parseCommandDispatchMessage,
  type CommandAckPayload
} from "@luna/protocol";
import type { DeviceCapability } from "@luna/shared-types";
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

type CanonicalFailureReason =
  | "invalid_params"
  | "unsupported_intent"
  | "execution_error";

const NOTIFY_INTENT = "notify" as const;
const OPEN_APP_INTENT = "open_app" as const;
const SET_VOLUME_INTENT = "set_volume" as const;
const PLAY_MEDIA_INTENT = "play_media" as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const extractLocalNotification = (
  params: Record<string, unknown>
): LocalNotification | null => {
  const title = params.title;
  const message = params.message;

  if (!isNonEmptyString(title) || !isNonEmptyString(message)) {
    return null;
  }

  return { title, message };
};

const extractLocalOpenApp = (
  params: Record<string, unknown>
): LocalOpenApp | null => {
  const appName = params.appName;
  if (!isNonEmptyString(appName)) {
    return null;
  }

  return { appName };
};

const extractLocalSetVolume = (
  params: Record<string, unknown>
): LocalSetVolume | null => {
  const volumePercent = params.volumePercent;
  if (
    typeof volumePercent !== "number" ||
    !Number.isInteger(volumePercent) ||
    volumePercent < 0 ||
    volumePercent > 100
  ) {
    return null;
  }

  return { volumePercent };
};

const extractLocalPlayMedia = (
  params: Record<string, unknown>
): LocalPlayMedia | null => {
  const mediaQuery = params.mediaQuery;
  if (!isNonEmptyString(mediaQuery)) {
    return null;
  }

  return { mediaQuery };
};

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

const getErrorReason = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown launcher error.";
};

const createSuccessAckPayload = (commandId: string): CommandAckPayload => ({
  commandId,
  status: COMMAND_ACK_STATUS_SUCCESS
});

const createFailedAckPayload = (
  commandId: string,
  reason: CanonicalFailureReason
): CommandAckPayload => ({
  commandId,
  status: COMMAND_ACK_STATUS_FAILED,
  reason
});

export const connectAgent = async (
  input: ConnectAgentInput
): Promise<AgentConnection> => {
  const socket = new WebSocket(input.serverUrl);
  const registerCapabilities =
    input.device.capabilities ?? SUPPORTED_CAPABILITIES;
  const heartbeatIntervalMs = input.heartbeatIntervalMs ?? 5_000;
  const executeNotify = input.executeNotify ?? executeLocalNotify;
  const executeOpenApp = input.executeOpenApp ?? executeLocalOpenApp;
  const executeSetVolume = input.executeSetVolume ?? executeLocalSetVolume;
  const executePlayMedia = input.executePlayMedia ?? executeLocalPlayMedia;
  let heartbeatInterval: NodeJS.Timeout | undefined;

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
      let commandAckPayload = createSuccessAckPayload(commandId);

      try {
        if (dispatchMessage.payload.intent === NOTIFY_INTENT) {
          const notification = extractLocalNotification(
            dispatchMessage.payload.params
          );
          if (!notification) {
            commandAckPayload = createFailedAckPayload(
              commandId,
              "invalid_params"
            );
          } else {
            try {
              await executeNotify(notification);
            } catch (error) {
              const reason = getErrorReason(error);
              console.error("[luna][notify][error]", {
                commandId,
                title: notification.title,
                message: notification.message,
                reason
              });
              commandAckPayload = createFailedAckPayload(
                commandId,
                "execution_error"
              );
            }
          }
        } else if (dispatchMessage.payload.intent === OPEN_APP_INTENT) {
          const openApp = extractLocalOpenApp(dispatchMessage.payload.params);
          if (!openApp) {
            commandAckPayload = createFailedAckPayload(
              commandId,
              "invalid_params"
            );
          } else {
            try {
              await executeOpenApp(openApp);
            } catch (error) {
              const reason = getErrorReason(error);
              console.error("[luna][open_app][error]", {
                commandId,
                appName: openApp.appName,
                reason
              });
              commandAckPayload = createFailedAckPayload(
                commandId,
                "execution_error"
              );
            }
          }
        } else if (dispatchMessage.payload.intent === SET_VOLUME_INTENT) {
          const setVolume = extractLocalSetVolume(dispatchMessage.payload.params);
          if (!setVolume) {
            commandAckPayload = createFailedAckPayload(
              commandId,
              "invalid_params"
            );
          } else {
            try {
              await executeSetVolume(setVolume);
            } catch (error) {
              const reason = getErrorReason(error);
              console.error("[luna][set_volume][error]", {
                commandId,
                volumePercent: setVolume.volumePercent,
                reason
              });
              commandAckPayload = createFailedAckPayload(
                commandId,
                "execution_error"
              );
            }
          }
        } else if (dispatchMessage.payload.intent === PLAY_MEDIA_INTENT) {
          const playMedia = extractLocalPlayMedia(dispatchMessage.payload.params);
          if (!playMedia) {
            commandAckPayload = createFailedAckPayload(
              commandId,
              "invalid_params"
            );
          } else {
            try {
              await executePlayMedia(playMedia);
            } catch (error) {
              const reason = getErrorReason(error);
              console.error("[luna][play_media][error]", {
                commandId,
                mediaQuery: playMedia.mediaQuery,
                reason
              });
              commandAckPayload = createFailedAckPayload(
                commandId,
                "execution_error"
              );
            }
          }
        } else {
          commandAckPayload = createFailedAckPayload(
            commandId,
            "unsupported_intent"
          );
        }

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
    if (!heartbeatInterval) {
      return;
    }

    clearInterval(heartbeatInterval);
    heartbeatInterval = undefined;
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

      await new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
};
