export const commandParserBootstrapReady = true;

export const OPEN_APP_INTENT = "open_app" as const;

export interface OpenAppCommand {
  intent: typeof OPEN_APP_INTENT;
  targetDeviceName: string;
  params: {
    appName: string;
  };
}

export type ParsedCommand = OpenAppCommand;

const normalizeWhitespace = (value: string): string =>
  value
    .trim()
    .replace(/\s+/g, " ");

export const parseCommand = (rawText: string): ParsedCommand | null => {
  const normalizedText = normalizeWhitespace(rawText);
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
