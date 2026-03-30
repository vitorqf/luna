import { describe, expect, it } from "vitest";
import { connectAgent } from "../../agent/src/index";
import { createLunaServer } from "../src/index";

const DEFAULT_AGENT_CAPABILITIES = [
  "notify",
  "open_app",
  "set_volume",
  "play_media"
] as const;

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

describe("slice 18 - device presence", () => {
  it("marks device as offline when active socket disconnects and keeps device registered", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });

      await agentConnection.disconnect();
      agentConnection = undefined;

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "offline",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("sets device back to online when reconnecting with same id", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let firstConnection: { disconnect: () => Promise<void> } | undefined;
    let secondConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      firstConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      await firstConnection.disconnect();
      firstConnection = undefined;

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "offline",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });

      secondConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2 Renovado",
          hostname: "notebook-2-renovado.local",
          capabilities: ["notify"]
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2 Renovado",
            hostname: "notebook-2-renovado.local",
            status: "online",
            capabilities: ["notify"]
          }
        ]);
      });

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices`
      );
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        {
          id: "notebook-2",
          name: "Notebook 2 Renovado",
          hostname: "notebook-2-renovado.local",
          status: "online",
          capabilities: ["notify"]
        }
      ]);
    } finally {
      if (secondConnection) {
        await secondConnection.disconnect();
      }

      if (firstConnection) {
        await firstConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("keeps device online when stale socket closes after reconnection", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let staleConnection: { disconnect: () => Promise<void> } | undefined;
    let activeConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      staleConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      activeConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });

      await staleConnection.disconnect();
      staleConnection = undefined;

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });
    } finally {
      if (activeConnection) {
        await activeConnection.disconnect();
      }

      if (staleConnection) {
        await staleConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("returns offline device in GET /devices and dispatch still fails as not connected", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

      await agentConnection.disconnect();
      agentConnection = undefined;

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "offline",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          status: "offline",
          capabilities: [...DEFAULT_AGENT_CAPABILITIES]
        }
      ]);

      await expect(
        server.dispatchCommand({
          targetDeviceId: "notebook-2",
          intent: "notify",
          params: {
            title: "Luna",
            message: "Slice 18"
          }
        })
      ).rejects.toThrowError("Device notebook-2 is not connected.");
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });
});
