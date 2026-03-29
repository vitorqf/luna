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

describe("slice 14 - set volume execution", () => {
  it("executes set_volume on the agent when server dispatches a set_volume command", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeSetVolume = vi.fn(async () => undefined);

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        executeSetVolume
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "set_volume",
        params: {
          volumePercent: 50
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "success"
      });

      expect(executeSetVolume).toHaveBeenCalledTimes(1);
      expect(executeSetVolume).toHaveBeenCalledWith({
        volumePercent: 50
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("keeps ack flow even when set_volume launcher fails", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const onCommand = vi.fn(async () => undefined);
    const executeSetVolume = vi.fn(async () => {
      throw new Error("set_volume failure");
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
        executeSetVolume
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "set_volume",
        params: {
          volumePercent: 50
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
        intent: "set_volume",
        params: {
          volumePercent: 50
        }
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[luna][set_volume][error]",
        expect.objectContaining({
          commandId: ack.commandId,
          volumePercent: 50,
          reason: "set_volume failure"
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
