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

describe("slice 7 - command history", () => {
  it("stores dispatched commands in memory and returns them through GET /commands", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    const executeNotify = vi.fn(async () => undefined);
    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        executeNotify
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        rawText: "Notificar Notebook 2",
        targetDeviceId: "notebook-2",
        intent: "notify",
        params: {
          title: "Luna",
          message: "Slice 7"
        }
      });

      expect(ack.status).toBe("acknowledged");

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        {
          id: ack.commandId,
          rawText: "Notificar Notebook 2",
          intent: "notify",
          targetDeviceId: "notebook-2",
          params: {
            title: "Luna",
            message: "Slice 7"
          },
          status: "acknowledged"
        }
      ]);
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });
});
