import { NOTIFY_INTENT } from "../parser-types";
import {
  NOTIFY_PREFIX_PATTERN,
  splitByLastDeviceSeparator
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parseNotifyUnquotedRule: ParseRule = (normalizedText) => {
  const notifyUnquotedMatch = normalizedText.match(
    new RegExp(`^(?:${NOTIFY_PREFIX_PATTERN})\\s+(.+)$`, "i")
  );
  if (!notifyUnquotedMatch) {
    return NO_MATCH;
  }

  const split = splitByLastDeviceSeparator(notifyUnquotedMatch[1] ?? "");
  if (!split) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: NOTIFY_INTENT,
    targetDeviceName: split.targetDeviceName,
    params: {
      title: "Luna",
      message: split.content
    }
  });
};
