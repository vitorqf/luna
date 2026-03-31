import { OPEN_APP_INTENT } from "../parser-types";
import {
  normalizeWhitespace,
  OPEN_APP_VERBS_PATTERN
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parseOpenAppRule: ParseRule = (normalizedText) => {
  const openAppMatch = normalizedText.match(
    new RegExp(
      `^(?:${OPEN_APP_VERBS_PATTERN})\\s+(?:(?:o|a)\\s+)?(.+?)\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (!openAppMatch) {
    return NO_MATCH;
  }

  const appName = normalizeWhitespace(openAppMatch[1] ?? "");
  const targetDeviceName = normalizeWhitespace(openAppMatch[2] ?? "");
  if (!appName || !targetDeviceName) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: OPEN_APP_INTENT,
    targetDeviceName,
    params: {
      appName
    }
  });
};
