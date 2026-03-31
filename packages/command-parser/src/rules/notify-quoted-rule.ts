import { NOTIFY_INTENT } from "../parser-types";
import {
  normalizeWhitespace,
  NOTIFY_PREFIX_PATTERN
} from "../parser-utils";
import {
  createMatchResult,
  NO_MATCH,
  type ParseRule
} from "./parse-rule";

export const parseNotifyQuotedRule: ParseRule = (normalizedText) => {
  const notifyQuotedMatch = normalizedText.match(
    new RegExp(
      `^(?:${NOTIFY_PREFIX_PATTERN})\\s+"([^"]*)"\\s+(?:no|na|em)\\s+(.+)$`,
      "i"
    )
  );
  if (!notifyQuotedMatch) {
    return NO_MATCH;
  }

  const message = notifyQuotedMatch[1]?.trim();
  const targetDeviceName = normalizeWhitespace(notifyQuotedMatch[2] ?? "");
  if (!message || !targetDeviceName) {
    return createMatchResult(null);
  }

  return createMatchResult({
    intent: NOTIFY_INTENT,
    targetDeviceName,
    params: {
      title: "Luna",
      message
    }
  });
};
