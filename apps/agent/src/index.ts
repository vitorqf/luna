import {
  COMMAND_ACK_STATUS_ACKNOWLEDGED,
  createAgentRegisterMessage,
  createCommandAckMessage,
  parseCommandDispatchMessage
} from "@luna/protocol";
import { createNotifyLauncher } from "./notify-launcher";
import { createOpenAppLauncher } from "./open-app-launcher";
import { createPlayMediaLauncher } from "./play-media-launcher";
import { createSetVolumeLauncher } from "./set-volume-launcher";
import { WebSocket } from "ws";

export const agentBootstrapReady = true;

export interface AgentIdentity {
  id: string;
  name: string;
  hostname: string;
}

export interface ConnectAgentInput {
  serverUrl: string;
  device: AgentIdentity;
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

export const connectAgent = async (
  input: ConnectAgentInput
): Promise<AgentConnection> => {
  const socket = new WebSocket(input.serverUrl);
  const executeNotify = input.executeNotify ?? executeLocalNotify;
  const executeOpenApp = input.executeOpenApp ?? executeLocalOpenApp;
  const executeSetVolume = input.executeSetVolume ?? executeLocalSetVolume;
  const executePlayMedia = input.executePlayMedia ?? executeLocalPlayMedia;

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
      try {
        if (dispatchMessage.payload.intent === NOTIFY_INTENT) {
          const notification = extractLocalNotification(
            dispatchMessage.payload.params
          );
          if (notification) {
            try {
              await executeNotify(notification);
            } catch (error) {
              console.error("[luna][notify][error]", {
                commandId: dispatchMessage.payload.commandId,
                title: notification.title,
                message: notification.message,
                reason: getErrorReason(error)
              });
            }
          }
        } else if (dispatchMessage.payload.intent === OPEN_APP_INTENT) {
          const openApp = extractLocalOpenApp(dispatchMessage.payload.params);
          if (openApp) {
            try {
              await executeOpenApp(openApp);
            } catch (error) {
              console.error("[luna][open_app][error]", {
                commandId: dispatchMessage.payload.commandId,
                appName: openApp.appName,
                reason: getErrorReason(error)
              });
            }
          }
        } else if (dispatchMessage.payload.intent === SET_VOLUME_INTENT) {
          const setVolume = extractLocalSetVolume(dispatchMessage.payload.params);
          if (setVolume) {
            try {
              await executeSetVolume(setVolume);
            } catch (error) {
              console.error("[luna][set_volume][error]", {
                commandId: dispatchMessage.payload.commandId,
                volumePercent: setVolume.volumePercent,
                reason: getErrorReason(error)
              });
            }
          }
        } else if (dispatchMessage.payload.intent === PLAY_MEDIA_INTENT) {
          const playMedia = extractLocalPlayMedia(dispatchMessage.payload.params);
          if (playMedia) {
            try {
              await executePlayMedia(playMedia);
            } catch (error) {
              console.error("[luna][play_media][error]", {
                commandId: dispatchMessage.payload.commandId,
                mediaQuery: playMedia.mediaQuery,
                reason: getErrorReason(error)
              });
            }
          }
        }

        await input.onCommand?.({
          commandId: dispatchMessage.payload.commandId,
          intent: dispatchMessage.payload.intent,
          params: dispatchMessage.payload.params
        });
      } finally {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        await sendSerializedMessage(
          JSON.stringify(
            createCommandAckMessage({
              commandId: dispatchMessage.payload.commandId,
              status: COMMAND_ACK_STATUS_ACKNOWLEDGED
            })
          )
        );
      }
    })().catch(() => undefined);
  });

  await sendSerializedMessage(
    JSON.stringify(createAgentRegisterMessage(input.device))
  );

  return {
    disconnect: async () => {
      if (socket.readyState === WebSocket.CLOSED) {
        return;
      }

      await new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
};
