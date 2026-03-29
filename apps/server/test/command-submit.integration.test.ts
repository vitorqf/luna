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

describe("slice 8 - command submit endpoint", () => {
  it("parses raw text, dispatches command to target device and returns ack in POST /commands", async () => {
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

      const response = await fetch(`http://127.0.0.1:${server.getPort()}/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rawText: "Abrir Spotify no Notebook 2"
        })
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        commandId: string;
        targetDeviceId: string;
        status: string;
      };
      expect(payload).toEqual({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "acknowledged"
      });

      expect(executeOpenApp).toHaveBeenCalledTimes(1);
      expect(executeOpenApp).toHaveBeenCalledWith({
        appName: "Spotify"
      });

      const historyResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: payload.commandId,
          rawText: "Abrir Spotify no Notebook 2",
          intent: "open_app",
          targetDeviceId: "notebook-2",
          params: {
            appName: "Spotify"
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

  it("returns 422 when raw command text is not supported by parser", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(`http://127.0.0.1:${server.getPort()}/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rawText: "Comando invalido"
        })
      });

      expect(response.status).toBe(422);
      await expect(response.json()).resolves.toEqual({
        message: "Unable to parse command."
      });
    } finally {
      await server.stop();
    }
  });

  it("returns 404 when parsed target device is not registered", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(`http://127.0.0.1:${server.getPort()}/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rawText: "Abrir Spotify no Notebook 2"
        })
      });

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        message: "Target device is not registered."
      });
    } finally {
      await server.stop();
    }
  });

  it("parses notify phrase, dispatches notify and stores notify history in POST /commands", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeNotify = vi.fn(async () => undefined);
    const rawText = 'Notificar "Backup concluido" no Notebook 2';

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

      const response = await fetch(`http://127.0.0.1:${server.getPort()}/commands`, {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          rawText
        })
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        commandId: string;
        targetDeviceId: string;
        status: string;
      };
      expect(payload).toEqual({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "acknowledged"
      });

      expect(executeNotify).toHaveBeenCalledTimes(1);
      expect(executeNotify).toHaveBeenCalledWith({
        title: "Luna",
        message: "Backup concluido"
      });

      const historyResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: payload.commandId,
          rawText,
          intent: "notify",
          targetDeviceId: "notebook-2",
          params: {
            title: "Luna",
            message: "Backup concluido"
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
