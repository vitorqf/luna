import { describe, expect, expectTypeOf, it } from "vitest";
import {
  COMMAND_FAILURE_REASONS,
  COMMAND_INTENTS,
  COMMAND_STATUSES,
  DEVICE_CAPABILITIES,
  DEVICE_STATUSES,
  NOTIFY_INTENT,
  OPEN_APP_INTENT,
  PLAY_MEDIA_INTENT,
  SET_VOLUME_INTENT,
  isCommandFailureReason,
  isCommandIntent,
  isCommandStatus,
  isDeviceCapability,
  isDeviceStatus,
  type CommandFailureReason,
  type CommandIntent,
  type CommandStatus,
  type DeviceCapability,
  type DeviceStatus,
} from "../src/index";

describe("slice 53 - shared contract catalog", () => {
  it("exports canonical runtime catalogs in the current canonical order", () => {
    expect(DEVICE_STATUSES).toEqual(["online", "offline"]);
    expect(DEVICE_CAPABILITIES).toEqual([
      "notify",
      "open_app",
      "set_volume",
      "play_media",
    ]);
    expect(COMMAND_STATUSES).toEqual(["success", "failed"]);
    expect(COMMAND_FAILURE_REASONS).toEqual([
      "invalid_params",
      "unsupported_intent",
      "execution_error",
    ]);
    expect(COMMAND_INTENTS).toEqual([
      "open_app",
      "notify",
      "set_volume",
      "play_media",
    ]);
  });

  it("exports per-intent constants that match the canonical command intent catalog", () => {
    expect(OPEN_APP_INTENT).toBe(COMMAND_INTENTS[0]);
    expect(NOTIFY_INTENT).toBe(COMMAND_INTENTS[1]);
    expect(SET_VOLUME_INTENT).toBe(COMMAND_INTENTS[2]);
    expect(PLAY_MEDIA_INTENT).toBe(COMMAND_INTENTS[3]);
  });

  it("exports guard helpers for canonical values", () => {
    expect(isDeviceStatus("online")).toBe(true);
    expect(isDeviceStatus("pending")).toBe(false);

    expect(isDeviceCapability("notify")).toBe(true);
    expect(isDeviceCapability("shutdown")).toBe(false);

    expect(isCommandStatus("success")).toBe(true);
    expect(isCommandStatus("pending")).toBe(false);

    expect(isCommandFailureReason("execution_error")).toBe(true);
    expect(isCommandFailureReason("timeout")).toBe(false);

    expect(isCommandIntent("play_media")).toBe(true);
    expect(isCommandIntent("shutdown")).toBe(false);
  });

  it("keeps exported literal union types aligned with the runtime catalogs", () => {
    expectTypeOf<DeviceStatus>().toEqualTypeOf<
      (typeof DEVICE_STATUSES)[number]
    >();
    expectTypeOf<DeviceCapability>().toEqualTypeOf<
      (typeof DEVICE_CAPABILITIES)[number]
    >();
    expectTypeOf<CommandStatus>().toEqualTypeOf<
      (typeof COMMAND_STATUSES)[number]
    >();
    expectTypeOf<CommandFailureReason>().toEqualTypeOf<
      (typeof COMMAND_FAILURE_REASONS)[number]
    >();
    expectTypeOf<CommandIntent>().toEqualTypeOf<
      (typeof COMMAND_INTENTS)[number]
    >();
  });
});
