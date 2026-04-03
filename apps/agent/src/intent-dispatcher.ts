import {
  COMMAND_ACK_STATUS_FAILED,
  COMMAND_ACK_STATUS_SUCCESS,
  type CommandAckPayload
} from "@luna/protocol";
import {
  COMMAND_INTENTS,
  isCommandIntent,
  type CommandFailureReason,
} from "@luna/shared-types";

interface LocalNotification {
  title: string;
  message: string;
}

interface LocalOpenApp {
  appName: string;
}

interface LocalSetVolume {
  volumePercent: number;
}

interface LocalPlayMedia {
  mediaQuery: string;
}

interface IntentStrategyInput {
  commandId: string;
  params: Record<string, unknown>;
}

interface IntentStrategy {
  execute: (input: IntentStrategyInput) => Promise<CommandAckPayload>;
}

const SUPPORTED_INTENTS = COMMAND_INTENTS;

type SupportedIntent = (typeof SUPPORTED_INTENTS)[number];
type IntentStrategyMap = Record<SupportedIntent, IntentStrategy>;

export interface IntentDispatcherExecutors {
  executeNotify: (
    notification: LocalNotification
  ) => void | Promise<void>;
  executeOpenApp: (
    openApp: LocalOpenApp
  ) => void | Promise<void>;
  executeSetVolume: (
    setVolume: LocalSetVolume
  ) => void | Promise<void>;
  executePlayMedia: (
    playMedia: LocalPlayMedia
  ) => void | Promise<void>;
}

export interface DispatchIntentExecutionInput {
  commandId: string;
  intent: string;
  params: Record<string, unknown>;
  executors: IntentDispatcherExecutors;
}

const isSupportedIntent = (value: string): value is SupportedIntent =>
  isCommandIntent(value);

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
  reason: CommandFailureReason
): CommandAckPayload => ({
  commandId,
  status: COMMAND_ACK_STATUS_FAILED,
  reason
});

const createIntentStrategyMap = (
  executors: IntentDispatcherExecutors
): IntentStrategyMap => ({
  notify: {
    execute: async ({ commandId, params }) => {
      const notification = extractLocalNotification(params);
      if (!notification) {
        return createFailedAckPayload(commandId, "invalid_params");
      }

      try {
        await executors.executeNotify(notification);
        return createSuccessAckPayload(commandId);
      } catch (error) {
        console.error("[luna][notify][error]", {
          commandId,
          title: notification.title,
          message: notification.message,
          reason: getErrorReason(error)
        });
        return createFailedAckPayload(commandId, "execution_error");
      }
    }
  },
  open_app: {
    execute: async ({ commandId, params }) => {
      const openApp = extractLocalOpenApp(params);
      if (!openApp) {
        return createFailedAckPayload(commandId, "invalid_params");
      }

      try {
        await executors.executeOpenApp(openApp);
        return createSuccessAckPayload(commandId);
      } catch (error) {
        console.error("[luna][open_app][error]", {
          commandId,
          appName: openApp.appName,
          reason: getErrorReason(error)
        });
        return createFailedAckPayload(commandId, "execution_error");
      }
    }
  },
  set_volume: {
    execute: async ({ commandId, params }) => {
      const setVolume = extractLocalSetVolume(params);
      if (!setVolume) {
        return createFailedAckPayload(commandId, "invalid_params");
      }

      try {
        await executors.executeSetVolume(setVolume);
        return createSuccessAckPayload(commandId);
      } catch (error) {
        console.error("[luna][set_volume][error]", {
          commandId,
          volumePercent: setVolume.volumePercent,
          reason: getErrorReason(error)
        });
        return createFailedAckPayload(commandId, "execution_error");
      }
    }
  },
  play_media: {
    execute: async ({ commandId, params }) => {
      const playMedia = extractLocalPlayMedia(params);
      if (!playMedia) {
        return createFailedAckPayload(commandId, "invalid_params");
      }

      try {
        await executors.executePlayMedia(playMedia);
        return createSuccessAckPayload(commandId);
      } catch (error) {
        console.error("[luna][play_media][error]", {
          commandId,
          mediaQuery: playMedia.mediaQuery,
          reason: getErrorReason(error)
        });
        return createFailedAckPayload(commandId, "execution_error");
      }
    }
  }
});

export const dispatchIntentExecution = async (
  input: DispatchIntentExecutionInput
): Promise<CommandAckPayload> => {
  const { commandId, intent, params, executors } = input;

  if (!isSupportedIntent(intent)) {
    return createFailedAckPayload(commandId, "unsupported_intent");
  }

  const strategyMap = createIntentStrategyMap(executors);
  return strategyMap[intent].execute({
    commandId,
    params
  });
};
