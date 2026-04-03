export {
  NOTIFY_INTENT,
  OPEN_APP_INTENT,
  PLAY_MEDIA_INTENT,
  SET_VOLUME_INTENT,
} from "@luna/shared-types";
import {
  NOTIFY_INTENT,
  OPEN_APP_INTENT,
  PLAY_MEDIA_INTENT,
  SET_VOLUME_INTENT,
} from "@luna/shared-types";

export interface OpenAppCommand {
  intent: typeof OPEN_APP_INTENT;
  targetDeviceName: string;
  params: {
    appName: string;
  };
}

export interface NotifyCommand {
  intent: typeof NOTIFY_INTENT;
  targetDeviceName: string;
  params: {
    title: string;
    message: string;
  };
}

export interface SetVolumeCommand {
  intent: typeof SET_VOLUME_INTENT;
  targetDeviceName: string;
  params: {
    volumePercent: number;
  };
}

export interface PlayMediaCommand {
  intent: typeof PLAY_MEDIA_INTENT;
  targetDeviceName: string;
  params: {
    mediaQuery: string;
  };
}

export type ParsedCommand =
  | OpenAppCommand
  | NotifyCommand
  | SetVolumeCommand
  | PlayMediaCommand;
