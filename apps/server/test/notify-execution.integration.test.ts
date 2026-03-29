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

describe("slice 5 - notify execution", () => {
  it("executes notify on the agent when server dispatches a notify command", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeNotify = vi.fn(async () => undefined);

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
        targetDeviceId: "notebook-2",
        intent: "notify",
        params: {
          title: "Luna",
          message: "Slice 5"
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "success"
      });

      expect(executeNotify).toHaveBeenCalledTimes(1);
      expect(executeNotify).toHaveBeenCalledWith({
        title: "Luna",
        message: "Slice 5"
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("keeps ack flow even when notify launcher fails", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const onCommand = vi.fn(async () => undefined);
    const executeNotify = vi.fn(async () => {
      throw new Error("notify failure");
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
        executeNotify
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "notify",
        params: {
          title: "Luna",
          message: "Slice 13"
        }
      });

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "notify failure"
      });

      expect(onCommand).toHaveBeenCalledWith({
        commandId: ack.commandId,
        intent: "notify",
        params: {
          title: "Luna",
          message: "Slice 13"
        }
      });

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "[luna][notify][error]",
        expect.objectContaining({
          commandId: ack.commandId,
          title: "Luna",
          message: "Slice 13",
          reason: "notify failure"
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
