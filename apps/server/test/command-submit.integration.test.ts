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
        status: "success"
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
          status: "success"
        }
      ]);
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("returns failed status with reason when command execution fails", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeOpenApp = vi.fn(async () => {
      throw new Error("open_app launcher failed");
    });
    const rawText = "Abrir Spotify no Notebook 2";

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
          rawText
        })
      });

      expect(response.status).toBe(200);
      const payload = (await response.json()) as {
        commandId: string;
        targetDeviceId: string;
        status: string;
        reason?: string;
      };
      expect(payload).toEqual({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "execution_error"
      });

      const historyResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: payload.commandId,
          rawText,
          intent: "open_app",
          targetDeviceId: "notebook-2",
          params: {
            appName: "Spotify"
          },
          status: "failed",
          reason: "execution_error"
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
        status: "success"
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
          status: "success"
        }
      ]);
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("parses set_volume phrase, dispatches set_volume and stores set_volume history in POST /commands", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executeSetVolume = vi.fn(async () => undefined);
    const rawText = "Definir volume para 50% no Notebook 2";

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
        status: "success"
      });

      expect(executeSetVolume).toHaveBeenCalledTimes(1);
      expect(executeSetVolume).toHaveBeenCalledWith({
        volumePercent: 50
      });

      const historyResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: payload.commandId,
          rawText,
          intent: "set_volume",
          targetDeviceId: "notebook-2",
          params: {
            volumePercent: 50
          },
          status: "success"
        }
      ]);
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("parses play_media phrase, dispatches play_media and stores play_media history in POST /commands", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;
    const executePlayMedia = vi.fn(async () => undefined);
    const rawText = 'Tocar "lo-fi" no Notebook 2';

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
        status: "success"
      });

      expect(executePlayMedia).toHaveBeenCalledTimes(1);
      expect(executePlayMedia).toHaveBeenCalledWith({
        mediaQuery: "lo-fi"
      });

      const historyResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`
      );
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: payload.commandId,
          rawText,
          intent: "play_media",
          targetDeviceId: "notebook-2",
          params: {
            mediaQuery: "lo-fi"
          },
          status: "success"
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
