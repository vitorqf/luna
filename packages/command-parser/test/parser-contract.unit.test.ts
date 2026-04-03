import { describe, expect, it } from "vitest";
import {
  COMMAND_INTENTS,
  NOTIFY_INTENT as SHARED_NOTIFY_INTENT,
  OPEN_APP_INTENT as SHARED_OPEN_APP_INTENT,
  PLAY_MEDIA_INTENT as SHARED_PLAY_MEDIA_INTENT,
  SET_VOLUME_INTENT as SHARED_SET_VOLUME_INTENT,
} from "@luna/shared-types";
import {
  NOTIFY_INTENT,
  OPEN_APP_INTENT,
  PLAY_MEDIA_INTENT,
  SET_VOLUME_INTENT,
} from "../src/index";

describe("slice 53 - parser shared intent contract", () => {
  it("re-exports the same intent constants defined by shared-types", () => {
    expect(OPEN_APP_INTENT).toBe(SHARED_OPEN_APP_INTENT);
    expect(NOTIFY_INTENT).toBe(SHARED_NOTIFY_INTENT);
    expect(SET_VOLUME_INTENT).toBe(SHARED_SET_VOLUME_INTENT);
    expect(PLAY_MEDIA_INTENT).toBe(SHARED_PLAY_MEDIA_INTENT);
    expect([
      OPEN_APP_INTENT,
      NOTIFY_INTENT,
      SET_VOLUME_INTENT,
      PLAY_MEDIA_INTENT,
    ]).toEqual(COMMAND_INTENTS);
  });
});
