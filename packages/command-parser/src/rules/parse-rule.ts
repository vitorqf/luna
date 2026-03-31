import type { ParsedCommand } from "../parser-types";

export type ParseRuleResult =
  | {
      kind: "no_match";
    }
  | {
      kind: "matched";
      parsedCommand: ParsedCommand | null;
    };

export type ParseRule = (normalizedText: string) => ParseRuleResult;

export const NO_MATCH: ParseRuleResult = {
  kind: "no_match"
};

export const createMatchResult = (
  parsedCommand: ParsedCommand | null
): ParseRuleResult => ({
  kind: "matched",
  parsedCommand
});
