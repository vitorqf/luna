import type { ParsedCommand } from "./parser-types";
import { normalizeWhitespace } from "./parser-utils";
import { parseNotifyQuotedRule } from "./rules/notify-quoted-rule";
import { parseNotifyUnquotedRule } from "./rules/notify-unquoted-rule";
import { parsePlayMediaQuotedRule } from "./rules/play-media-quoted-rule";
import { parsePlayMediaUnquotedRule } from "./rules/play-media-unquoted-rule";
import { parseSetVolumeRule } from "./rules/set-volume-rule";
import { parseOpenAppRule } from "./rules/open-app-rule";
import type { ParseRule } from "./rules/parse-rule";

export const PARSER_RULES: readonly ParseRule[] = [
  parseNotifyQuotedRule,
  parseNotifyUnquotedRule,
  parsePlayMediaQuotedRule,
  parsePlayMediaUnquotedRule,
  parseSetVolumeRule,
  parseOpenAppRule
];

export const parseCommandWithRuleChain = (
  rawText: string
): ParsedCommand | null => {
  const normalizedText = normalizeWhitespace(rawText);
  if (!normalizedText) {
    return null;
  }

  for (const parseRule of PARSER_RULES) {
    const parseResult = parseRule(normalizedText);
    if (parseResult.kind === "matched") {
      return parseResult.parsedCommand;
    }
  }

  return null;
};
