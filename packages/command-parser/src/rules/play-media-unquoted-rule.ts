import { PLAY_MEDIA_INTENT } from "../parser-types";
import {
  PLAY_MEDIA_VERBS_PATTERN,
  splitByLastDeviceSeparator
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parsePlayMediaUnquotedRule: ParseRule = (normalizedText) => {
  const playMediaUnquotedMatch = normalizedText.match(
    new RegExp(`^(?:${PLAY_MEDIA_VERBS_PATTERN})\\s+(.+)$`, "i")
  );
  if (!playMediaUnquotedMatch) {
    return NO_MATCH;
  }

  const split = splitByLastDeviceSeparator(playMediaUnquotedMatch[1] ?? "");
  if (!split) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: PLAY_MEDIA_INTENT,
    targetDeviceName: split.targetDeviceName,
    params: {
      mediaQuery: split.content
    }
  });
};
