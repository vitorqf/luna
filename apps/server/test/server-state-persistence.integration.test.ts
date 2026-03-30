import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSocket } from "node:dgram";
import { describe, expect, it, vi } from "vitest";
import { createAgentDiscoveryAnnounceMessage } from "@luna/protocol";
import { connectAgent } from "../../agent/src/index";
import { createLunaServer } from "../src/index";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForAssertion = async (
  assertion: () => void,
  timeoutMs = 1_000,
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

const sendUdpMessage = async (
  host: string,
  port: number,
  payload: unknown,
): Promise<void> => {
  const socket = createSocket("udp4");

  await new Promise<void>((resolve, reject) => {
    socket.send(
      Buffer.from(JSON.stringify(payload), "utf-8"),
      port,
      host,
      (error) => {
        socket.close();
        if (error) {
          reject(error);
          return;
        }

        resolve();
      },
    );
  });
};

describe("slice 37 - server state persistence", () => {
  it("keeps approved devices after restart and reloads them as offline", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");
    const firstServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });

    await firstServer.start();

    try {
      await sendUdpMessage(
        "127.0.0.1",
        firstServer.getPort(),
        createAgentDiscoveryAnnounceMessage({
          id: "mini-pc-1",
          hostname: "mini-pc-1.local",
          capabilities: ["notify"],
        }),
      );

      await waitForAssertion(() => {
        expect(firstServer.getDiscoveredAgents()).toEqual([
          {
            id: "mini-pc-1",
            hostname: "mini-pc-1.local",
            capabilities: ["notify"],
          },
        ]);
      });

      const approveResponse = await fetch(
        `http://127.0.0.1:${firstServer.getPort()}/discovery/agents/mini-pc-1/approve`,
        {
          method: "POST",
        },
      );
      expect(approveResponse.status).toBe(200);
    } finally {
      await firstServer.stop();
    }

    const secondServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });
    await secondServer.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${secondServer.getPort()}/devices`,
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        {
          id: "mini-pc-1",
          name: "mini-pc-1.local",
          hostname: "mini-pc-1.local",
          status: "offline",
          capabilities: ["notify"],
        },
      ]);
    } finally {
      await secondServer.stop();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("preserves custom alias across restart and reconnect", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");
    const firstServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });

    await firstServer.start();

    let firstConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      firstConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${firstServer.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
        },
      });

      await waitForAssertion(() => {
        expect(firstServer.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: ["notify", "open_app", "set_volume", "play_media"],
          },
        ]);
      });

      const renameResponse = await fetch(
        `http://127.0.0.1:${firstServer.getPort()}/devices/notebook-2`,
        {
          method: "PATCH",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            name: "Sala",
          }),
        },
      );
      expect(renameResponse.status).toBe(200);
    } finally {
      if (firstConnection) {
        await firstConnection.disconnect();
      }

      await firstServer.stop();
    }

    const secondServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });
    await secondServer.start();

    let secondConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      await waitForAssertion(() => {
        expect(secondServer.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Sala",
            hostname: "notebook-2.local",
            status: "offline",
            capabilities: ["notify", "open_app", "set_volume", "play_media"],
          },
        ]);
      });

      secondConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${secondServer.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2 Renovado",
          hostname: "notebook-2-renovado.local",
          capabilities: ["notify"],
        },
      });

      await waitForAssertion(() => {
        expect(secondServer.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Sala",
            hostname: "notebook-2-renovado.local",
            status: "online",
            capabilities: ["notify"],
          },
        ]);
      });
    } finally {
      if (secondConnection) {
        await secondConnection.disconnect();
      }

      await secondServer.stop();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps successful command history after restart", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");
    const firstServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });

    await firstServer.start();

    const executeNotify = vi.fn(async () => undefined);
    let connection: { disconnect: () => Promise<void> } | undefined;

    try {
      connection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${firstServer.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
        },
        executeNotify,
      });

      const response = await fetch(
        `http://127.0.0.1:${firstServer.getPort()}/commands`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            rawText: 'Notificar "Slice 37" no Notebook 2',
          }),
        },
      );

      expect(response.status).toBe(200);
      const acknowledgement = (await response.json()) as {
        commandId: string;
        targetDeviceId: string;
        status: string;
      };
      expect(acknowledgement).toEqual({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "success",
      });
    } finally {
      if (connection) {
        await connection.disconnect();
      }

      await firstServer.stop();
    }

    const secondServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });
    await secondServer.start();

    try {
      const historyResponse = await fetch(
        `http://127.0.0.1:${secondServer.getPort()}/commands`,
      );

      expect(historyResponse.status).toBe(200);
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: expect.any(String),
          rawText: 'Notificar "Slice 37" no Notebook 2',
          intent: "notify",
          targetDeviceId: "notebook-2",
          params: {
            title: "Luna",
            message: "Slice 37",
          },
          status: "success",
        },
      ]);
    } finally {
      await secondServer.stop();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("keeps unsupported intent failures in history after restart", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");
    const firstServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });

    await firstServer.start();

    let connection: { disconnect: () => Promise<void> } | undefined;
    const rawText = "Abrir Spotify no Notebook 2";

    try {
      connection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${firstServer.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
      });

      const response = await fetch(
        `http://127.0.0.1:${firstServer.getPort()}/commands`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            rawText,
          }),
        },
      );

      expect(response.status).toBe(200);
      const acknowledgement = (await response.json()) as {
        commandId: string;
        targetDeviceId: string;
        status: string;
        reason?: string;
      };
      expect(acknowledgement).toEqual({
        commandId: expect.any(String),
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "unsupported_intent",
      });
    } finally {
      if (connection) {
        await connection.disconnect();
      }

      await firstServer.stop();
    }

    const secondServer = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      stateFile,
    });
    await secondServer.start();

    try {
      const historyResponse = await fetch(
        `http://127.0.0.1:${secondServer.getPort()}/commands`,
      );

      expect(historyResponse.status).toBe(200);
      await expect(historyResponse.json()).resolves.toEqual([
        {
          id: expect.any(String),
          rawText,
          intent: "open_app",
          targetDeviceId: "notebook-2",
          params: {
            appName: "Spotify",
          },
          status: "failed",
          reason: "unsupported_intent",
        },
      ]);
    } finally {
      await secondServer.stop();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
