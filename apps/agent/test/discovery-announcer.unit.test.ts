import { describe, expect, it, vi } from "vitest";
import { createDiscoveryAnnouncer } from "../src/discovery-announcer";

describe("discovery announcer", () => {
  it("sends discovery announce immediately and on interval", () => {
    const close = vi.fn(() => undefined);
    const send = vi.fn(
      (
        _message: Buffer,
        _port: number,
        _address: string,
        callback?: (error: Error | null) => void
      ) => {
        callback?.(null);
      }
    );
    let intervalCallback: (() => void) | undefined;

    const start = createDiscoveryAnnouncer({
      createSocket: () => ({
        send,
        close
      }),
      setIntervalFn: ((callback: () => void) => {
        intervalCallback = callback;
        return 123 as unknown as NodeJS.Timeout;
      }) as typeof setInterval,
      clearIntervalFn: vi.fn()
    });

    const announcer = start({
      serverUrl: "ws://127.0.0.1:4000",
      device: {
        id: "notebook-2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app"]
      },
      intervalMs: 5_000
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(
      expect.any(Buffer),
      4000,
      "127.0.0.1",
      expect.any(Function)
    );
    const firstPayload = JSON.parse(
      send.mock.calls[0]![0].toString("utf-8")
    );
    expect(firstPayload).toEqual({
      type: "agent.discovery.announce",
      payload: {
        id: "notebook-2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app"]
      }
    });

    intervalCallback?.();
    expect(send).toHaveBeenCalledTimes(2);

    announcer.stop();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("throws for non-ws url protocol", () => {
    const start = createDiscoveryAnnouncer({
      createSocket: () => ({
        send: vi.fn(),
        close: vi.fn()
      }),
      setIntervalFn: setInterval,
      clearIntervalFn: clearInterval
    });

    expect(() =>
      start({
        serverUrl: "http://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"]
        },
        intervalMs: 5_000
      })
    ).toThrowError("Discovery requires ws:// or wss:// server URL.");
  });
});
