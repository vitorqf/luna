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

describe("slice 23 - device rename", () => {
  it("updates device alias through PATCH /devices/:id", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let connection: { disconnect: () => Promise<void> } | undefined;

    try {
      connection = await connectAgent({
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

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name: "  Sala   Notebook  "
          })
        }
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({
        id: "notebook-2",
        name: "Sala Notebook",
        hostname: "notebook-2.local",
        status: "online",
        capabilities: [...DEFAULT_AGENT_CAPABILITIES]
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Sala Notebook",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });
    } finally {
      if (connection) {
        await connection.disconnect();
      }

      await server.stop();
    }
  });

  it("returns 400 when request body is invalid JSON", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: "{"
        }
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        message: "Invalid JSON body."
      });
    } finally {
      await server.stop();
    }
  });

  it("returns 400 when name field is missing", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let connection: { disconnect: () => Promise<void> } | undefined;

    try {
      connection = await connectAgent({
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

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({})
        }
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        message: "name is required."
      });
    } finally {
      if (connection) {
        await connection.disconnect();
      }

      await server.stop();
    }
  });

  it("returns 400 when alias is empty", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let connection: { disconnect: () => Promise<void> } | undefined;

    try {
      connection = await connectAgent({
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

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name: "   "
          })
        }
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        message: "name is required."
      });
    } finally {
      if (connection) {
        await connection.disconnect();
      }

      await server.stop();
    }
  });

  it("returns 404 when device does not exist", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/missing-device`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name: "Sala"
          })
        }
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        message: "Device not found."
      });
    } finally {
      await server.stop();
    }
  });

  it("returns 409 when alias is already in use by another device", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let firstConnection: { disconnect: () => Promise<void> } | undefined;
    let secondConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      firstConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-1",
          name: "Notebook 1",
          hostname: "notebook-1.local"
        }
      });

      secondConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        }
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(2);
      });

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-1`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name: "notebook 2"
          })
        }
      );

      expect(response.status).toBe(409);
      await expect(response.json()).resolves.toEqual({
        message: "Device name is already in use."
      });
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

  it("preserves custom alias after reconnect with same id", async () => {
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

      const renameResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json"
          },
          body: JSON.stringify({
            name: "Sala"
          })
        }
      );
      expect(renameResponse.status).toBe(200);

      await firstConnection.disconnect();
      firstConnection = undefined;

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
            name: "Sala",
            hostname: "notebook-2-renovado.local",
            status: "online",
            capabilities: ["notify"]
          }
        ]);
      });
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
});
