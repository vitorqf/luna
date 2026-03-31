import { PLAY_MEDIA_INTENT } from "../parser-types";
import {
  normalizeWhitespace,
  PLAY_MEDIA_VERBS_PATTERN
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parsePlayMediaQuotedRule: ParseRule = (normalizedText) => {
  const playMediaQuotedMatch = normalizedText.match(
    new RegExp(
      `^(?:${PLAY_MEDIA_VERBS_PATTERN})\\s+"([^"]*)"\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (!playMediaQuotedMatch) {
    return NO_MATCH;
  }

  const mediaQuery = playMediaQuotedMatch[1]?.trim();
  const targetDeviceName = normalizeWhitespace(playMediaQuotedMatch[2] ?? "");
  if (!mediaQuery || !targetDeviceName) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: PLAY_MEDIA_INTENT,
    targetDeviceName,
    params: {
      mediaQuery
    }
  });
};
