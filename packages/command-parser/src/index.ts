export const commandParserBootstrapReady = true;

export const OPEN_APP_INTENT = "open_app" as const;
export const NOTIFY_INTENT = "notify" as const;
export const SET_VOLUME_INTENT = "set_volume" as const;

export interface OpenAppCommand {
  intent: typeof OPEN_APP_INTENT;
  targetDeviceName: string;
  params: {
    appName: string;
  };
}

export interface NotifyCommand {
  intent: typeof NOTIFY_INTENT;
  targetDeviceName: string;
  params: {
    title: string;
    message: string;
  };
}

export interface SetVolumeCommand {
  intent: typeof SET_VOLUME_INTENT;
  targetDeviceName: string;
  params: {
    volumePercent: number;
  };
}

export type ParsedCommand =
  | OpenAppCommand
  | NotifyCommand
  | SetVolumeCommand;

const normalizeWhitespace = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ");

export const parseCommand = (rawText: string): ParsedCommand | null => {
  const trimmedText = rawText.trim();
  const notifyMatch = trimmedText.match(/^notificar\s+"([^"]*)"\s+no\s+(.+)$/i);
  if (notifyMatch) {
    const message = notifyMatch[1]?.trim();
    const targetDeviceName = normalizeWhitespace(notifyMatch[2] ?? "");

    if (!message || !targetDeviceName) {
      return null;
    }

    return {
      intent: NOTIFY_INTENT,
      targetDeviceName,
      params: {
        title: "Luna",
        message
      }
    };
  }

  const normalizedText = normalizeWhitespace(rawText);
  const setVolumeMatch = normalizedText.match(
    /^definir\s+volume\s+para\s+(\d{1,3})(?:\s*%)?\s+no\s+(.+)$/i
  );
  if (setVolumeMatch) {
    const volumePercent = Number.parseInt(setVolumeMatch[1] ?? "", 10);
    const targetDeviceName = setVolumeMatch[2]?.trim();
    if (
      !targetDeviceName ||
      !Number.isInteger(volumePercent) ||
      volumePercent < 0 ||
      volumePercent > 100
    ) {
      return null;
    }

    return {
      intent: SET_VOLUME_INTENT,
      targetDeviceName,
      params: {
        volumePercent
      }
    };
  }

  const openAppMatch = normalizedText.match(/^abrir\s+(.+?)\s+no\s+(.+)$/i);

  if (!openAppMatch) {
    return null;
  }

  const appName = openAppMatch[1]?.trim();
  const targetDeviceName = openAppMatch[2]?.trim();

  if (!appName || !targetDeviceName) {
    return null;
  }

  return {
    intent: OPEN_APP_INTENT,
    targetDeviceName,
    params: {
      appName
    }
  };
};
