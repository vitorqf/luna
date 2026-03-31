export const commandParserBootstrapReady = true;

export {
  OPEN_APP_INTENT,
  NOTIFY_INTENT,
  SET_VOLUME_INTENT,
  PLAY_MEDIA_INTENT
} from "./parser-types";
export type {
  OpenAppCommand,
  NotifyCommand,
  SetVolumeCommand,
  PlayMediaCommand,
  ParsedCommand
} from "./parser-types";
export { parseCommandWithRuleChain as parseCommand } from "./parser-pipeline";
