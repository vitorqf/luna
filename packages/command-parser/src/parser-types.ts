export const OPEN_APP_INTENT = "open_app" as const;
export const NOTIFY_INTENT = "notify" as const;
export const SET_VOLUME_INTENT = "set_volume" as const;
export const PLAY_MEDIA_INTENT = "play_media" as const;

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
