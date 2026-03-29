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

describe("slice 6 - open app execution", () => {
  it("executes open_app on the agent when server dispatches an open_app command", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeOpenApp = vi.fn(async () => undefined);

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        executeOpenApp
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "open_app",
        params: {
          appName: "Spotify"
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "acknowledged"
      });

      expect(executeOpenApp).toHaveBeenCalledTimes(1);
      expect(executeOpenApp).toHaveBeenCalledWith({
        appName: "Spotify"
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });
});
