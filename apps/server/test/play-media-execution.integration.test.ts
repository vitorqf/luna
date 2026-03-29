import { describe, expect, it, vi } from "vitest";
import { connectAgent } from "../../agent/src/index";
import { createLunaServer } from "../src/index";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForAssertion = async (
  assertion: () => void,
  timeoutMs = 1_000
): Promise<void> => {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await sleep(25);
    }
  }

  throw lastError ?? new Error("Timed out waiting for assertion.");
};

describe("slice 15 - play media execution", () => {
  it("executes play_media on the agent when server dispatches a play_media command", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executePlayMedia = vi.fn(async () => undefined);

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        executePlayMedia
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "play_media",
        params: {
          mediaQuery: "lo-fi"
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "success"
      });

      expect(executePlayMedia).toHaveBeenCalledTimes(1);
      expect(executePlayMedia).toHaveBeenCalledWith({
        mediaQuery: "lo-fi"
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("keeps ack flow even when play_media launcher fails", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const onCommand = vi.fn(async () => undefined);
    const executePlayMedia = vi.fn(async () => {
      throw new Error("play_media failure");
    });
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        onCommand,
        executePlayMedia
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "play_media",
        params: {
          mediaQuery: "lo-fi"
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "execution_error"
      });

      expect(onCommand).toHaveBeenCalledWith({
        commandId: ack.commandId,
        intent: "play_media",
        params: {
          mediaQuery: "lo-fi"
        }
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[luna][play_media][error]",
        expect.objectContaining({
          commandId: ack.commandId,
          mediaQuery: "lo-fi",
          reason: "play_media failure"
        })
      );
    } finally {
      consoleErrorSpy.mockRestore();

      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });
});
