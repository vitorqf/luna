import { SET_VOLUME_INTENT } from "../parser-types";
import {
  normalizeWhitespace,
  SET_VOLUME_VERBS_PATTERN
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parseSetVolumeRule: ParseRule = (normalizedText) => {
  const setVolumeMatch = normalizedText.match(
    new RegExp(
      `^(?:${SET_VOLUME_VERBS_PATTERN})\\s+(?:o\\s+)?volume\\s+(?:para|em)\\s+(\\d{1,3})(?:\\s*%)?\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (!setVolumeMatch) {
    return NO_MATCH;
  }

  const volumePercent = Number.parseInt(setVolumeMatch[1] ?? "", 10);
  const targetDeviceName = normalizeWhitespace(setVolumeMatch[2] ?? "");
  if (
    !targetDeviceName ||
    !Number.isInteger(volumePercent) ||
    volumePercent < 0 ||
    volumePercent > 100
  ) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: SET_VOLUME_INTENT,
    targetDeviceName,
    params: {
      volumePercent
    }
  });
};
