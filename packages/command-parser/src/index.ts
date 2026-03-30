export const commandParserBootstrapReady = true;

export const OPEN_APP_INTENT = "open_app" as const;
export const NOTIFY_INTENT = "notify" as const;
export const SET_VOLUME_INTENT = "set_volume" as const;
export const PLAY_MEDIA_INTENT = "play_media" as const;

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

export interface PlayMediaCommand {
  intent: typeof PLAY_MEDIA_INTENT;
  targetDeviceName: string;
  params: {
    mediaQuery: string;
  };
}

export type ParsedCommand =
  | OpenAppCommand
  | NotifyCommand
  | SetVolumeCommand
  | PlayMediaCommand;

const normalizeWhitespace = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ");

const DEVICE_SEPARATOR_PATTERN = /^(no|na|em)$/i;

const OPEN_APP_VERBS_PATTERN = "abrir|abre|iniciar|inicia|executar|executa";
const NOTIFY_PREFIX_PATTERN =
  "notificar|avisar|enviar\\s+notifica(?:cao|ção)|mandar\\s+notifica(?:cao|ção)";
const PLAY_MEDIA_VERBS_PATTERN = "tocar|toque|reproduzir|reproduza";
const SET_VOLUME_VERBS_PATTERN = "definir|ajustar|colocar|setar";

const splitByLastDeviceSeparator = (
  value: string
): {
  content: string;
  targetDeviceName: string;
} | null => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const tokens = normalized.split(" ");
  for (let index = tokens.length - 2; index >= 1; index -= 1) {
    if (!DEVICE_SEPARATOR_PATTERN.test(tokens[index] ?? "")) {
      continue;
    }

    const content = tokens.slice(0, index).join(" ").trim();
    const targetDeviceName = tokens.slice(index + 1).join(" ").trim();
    if (!content || !targetDeviceName) {
      return null;
    }

    return {
      content,
      targetDeviceName
    };
  }

  return null;
};

export const parseCommand = (rawText: string): ParsedCommand | null => {
  const normalizedText = normalizeWhitespace(rawText);
  if (!normalizedText) {
    return null;
  }

  const notifyQuotedMatch = normalizedText.match(
    new RegExp(
      `^(?:${NOTIFY_PREFIX_PATTERN})\\s+"([^"]*)"\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (notifyQuotedMatch) {
    const message = notifyQuotedMatch[1]?.trim();
    const targetDeviceName = normalizeWhitespace(notifyQuotedMatch[2] ?? "");

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

  const notifyUnquotedMatch = normalizedText.match(
    new RegExp(`^(?:${NOTIFY_PREFIX_PATTERN})\\s+(.+)$`, "i")
  );
  if (notifyUnquotedMatch) {
    const split = splitByLastDeviceSeparator(notifyUnquotedMatch[1] ?? "");
    if (!split) {
      return null;
    }

    return {
      intent: NOTIFY_INTENT,
      targetDeviceName: split.targetDeviceName,
      params: {
        title: "Luna",
        message: split.content
      }
    };
  }

  const playMediaQuotedMatch = normalizedText.match(
    new RegExp(
      `^(?:${PLAY_MEDIA_VERBS_PATTERN})\\s+"([^"]*)"\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (playMediaQuotedMatch) {
    const mediaQuery = playMediaQuotedMatch[1]?.trim();
    const targetDeviceName = normalizeWhitespace(playMediaQuotedMatch[2] ?? "");

    if (!mediaQuery || !targetDeviceName) {
      return null;
    }

    return {
      intent: PLAY_MEDIA_INTENT,
      targetDeviceName,
      params: {
        mediaQuery
      }
    };
  }

  const playMediaUnquotedMatch = normalizedText.match(
    new RegExp(`^(?:${PLAY_MEDIA_VERBS_PATTERN})\\s+(.+)$`, "i")
  );
  if (playMediaUnquotedMatch) {
    const split = splitByLastDeviceSeparator(playMediaUnquotedMatch[1] ?? "");
    if (!split) {
      return null;
    }

    return {
      intent: PLAY_MEDIA_INTENT,
      targetDeviceName: split.targetDeviceName,
      params: {
        mediaQuery: split.content
      }
    };
  }

  const setVolumeMatch = normalizedText.match(
    new RegExp(
      `^(?:${SET_VOLUME_VERBS_PATTERN})\\s+(?:o\\s+)?volume\\s+(?:para|em)\\s+(\\d{1,3})(?:\\s*%)?\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (setVolumeMatch) {
    const volumePercent = Number.parseInt(setVolumeMatch[1] ?? "", 10);
    const targetDeviceName = normalizeWhitespace(setVolumeMatch[2] ?? "");
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

  const openAppMatch = normalizedText.match(
    new RegExp(
      `^(?:${OPEN_APP_VERBS_PATTERN})\\s+(?:(?:o|a)\\s+)?(.+?)\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );

  if (!openAppMatch) {
    return null;
  }

  const appName = normalizeWhitespace(openAppMatch[1] ?? "");
  const targetDeviceName = normalizeWhitespace(openAppMatch[2] ?? "");

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
