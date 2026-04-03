import { DEVICE_CAPABILITIES } from "@luna/shared-types";
import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { SUPPORTED_CAPABILITIES } from "../src/index";
import { dispatchIntentExecution } from "../src/intent-dispatcher";

const createExecutors = () => ({
  executeNotify: vi.fn(async () => undefined),
  executeOpenApp: vi.fn(async () => undefined),
  executeSetVolume: vi.fn(async () => undefined),
  executePlayMedia: vi.fn(async () => undefined)
});

describe("slice 39 - intent dispatcher", () => {
  it("reuses the shared capability catalog for agent registration defaults", () => {
    expect(SUPPORTED_CAPABILITIES).toBe(DEVICE_CAPABILITIES);
    expectTypeOf(SUPPORTED_CAPABILITIES).toEqualTypeOf<typeof DEVICE_CAPABILITIES>();
  });

  it("returns success and executes notify strategy when params are valid", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-1",
      intent: "notify",
      params: {
        title: "Luna",
        message: "Slice 39"
      },
      executors
    });

    expect(ack).toEqual({
      commandId: "command-1",
      status: "success"
    });
    expect(executors.executeNotify).toHaveBeenCalledTimes(1);
    expect(executors.executeNotify).toHaveBeenCalledWith({
      title: "Luna",
      message: "Slice 39"
    });
  });

  it("returns invalid_params for notify when params are invalid", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-2",
      intent: "notify",
      params: {
        title: "Luna"
      },
      executors
    });

    expect(ack).toEqual({
      commandId: "command-2",
      status: "failed",
      reason: "invalid_params"
    });
    expect(executors.executeNotify).not.toHaveBeenCalled();
  });

  it("returns invalid_params for open_app when params are invalid", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-3",
      intent: "open_app",
      params: {},
      executors
    });

    expect(ack).toEqual({
      commandId: "command-3",
      status: "failed",
      reason: "invalid_params"
    });
    expect(executors.executeOpenApp).not.toHaveBeenCalled();
  });

  it("returns invalid_params for set_volume when params are invalid", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-4",
      intent: "set_volume",
      params: {
        volumePercent: 200
      },
      executors
    });

    expect(ack).toEqual({
      commandId: "command-4",
      status: "failed",
      reason: "invalid_params"
    });
    expect(executors.executeSetVolume).not.toHaveBeenCalled();
  });

  it("returns invalid_params for play_media when params are invalid", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-5",
      intent: "play_media",
      params: {},
      executors
    });

    expect(ack).toEqual({
      commandId: "command-5",
      status: "failed",
      reason: "invalid_params"
    });
    expect(executors.executePlayMedia).not.toHaveBeenCalled();
  });

  it("returns unsupported_intent when intent is unknown", async () => {
    const executors = createExecutors();

    const ack = await dispatchIntentExecution({
      commandId: "command-6",
      intent: "unknown_intent",
      params: {},
      executors
    });

    expect(ack).toEqual({
      commandId: "command-6",
      status: "failed",
      reason: "unsupported_intent"
    });
  });

  it("returns execution_error and logs structured error when launcher throws", async () => {
    const executors = createExecutors();
    executors.executePlayMedia.mockImplementationOnce(async () => {
      throw new Error("play_media failure");
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const ack = await dispatchIntentExecution({
        commandId: "command-7",
        intent: "play_media",
        params: {
          mediaQuery: "lo-fi"
        },
        executors
      });

      expect(ack).toEqual({
        commandId: "command-7",
        status: "failed",
        reason: "execution_error"
      });
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[luna][play_media][error]",
        expect.objectContaining({
          commandId: "command-7",
          mediaQuery: "lo-fi",
          reason: "play_media failure"
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });
});
