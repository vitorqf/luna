import { describe, expect, it } from "vitest";
import { connectAgent, type ReceivedCommand } from "../../agent/src/index";
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

describe("slice 4 - command dispatch", () => {
  it("dispatches a command to a connected agent and receives ack", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    const receivedCommands: ReceivedCommand[] = [];
    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        onCommand: (command) => {
          receivedCommands.push(command);
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      const ack = await server.dispatchCommand({
        targetDeviceId: "notebook-2",
        intent: "notify",
        params: {
          title: "Luna",
          message: "Slice 4"
        }
      });

      expect(receivedCommands).toEqual([
        {
          commandId: ack.commandId,
          intent: "notify",
          params: {
            title: "Luna",
            message: "Slice 4"
          }
        }
      ]);

      expect(ack).toMatchObject({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "acknowledged"
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });
});
