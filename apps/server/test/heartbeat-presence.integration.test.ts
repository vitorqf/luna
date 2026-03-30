import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { connectAgent } from "../../agent/src/index";
import { createLunaServer } from "../src/index";
import {
  createAgentHeartbeatMessage,
  createAgentRegisterMessage
} from "@luna/protocol";

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

const waitForOpen = async (socket: WebSocket): Promise<void> => {
  if (socket.readyState === WebSocket.OPEN) {
    return;
  }

  if (socket.readyState === WebSocket.CLOSING || socket.readyState === WebSocket.CLOSED) {
    throw new Error("Socket closed before opening.");
  }

  await new Promise<void>((resolve, reject) => {
    const onOpen = () => {
      socket.off("error", onError);
      resolve();
    };
    const onError = (error: Error) => {
      socket.off("open", onOpen);
      reject(error);
    };

    socket.once("open", onOpen);
    socket.once("error", onError);
  });
};

const sendMessage = async (
  socket: WebSocket,
  serializedMessage: string
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    socket.send(serializedMessage, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const closeSocket = async (socket: WebSocket): Promise<void> => {
  if (
    socket.readyState === WebSocket.CLOSING ||
    socket.readyState === WebSocket.CLOSED
  ) {
    return;
  }

  await new Promise<void>((resolve) => {
    socket.once("close", () => resolve());
    socket.close();
  });
};

describe("slice 20 - heartbeat presence", () => {
  it("keeps device online when heartbeats are active", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      heartbeatTimeoutMs: 150
    });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        heartbeatIntervalMs: 40
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

      await sleep(350);

      expect(server.getRegisteredDevices()).toEqual([
        {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          status: "online",
          capabilities: [...DEFAULT_AGENT_CAPABILITIES]
        }
      ]);
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("marks device offline and rejects dispatch when heartbeat expires without socket close", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      heartbeatTimeoutMs: 120
    });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local"
        },
        heartbeatIntervalMs: 5_000
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
      }, 800);

      await expect(
        server.dispatchCommand({
          targetDeviceId: "notebook-2",
          intent: "notify",
          params: {
            title: "Luna",
            message: "Heartbeat timeout"
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

  it("returns to online after reconnecting with same id post-timeout", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      heartbeatTimeoutMs: 120
    });
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
        },
        heartbeatIntervalMs: 5_000
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toHaveLength(1);
      });

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
      }, 800);

      secondConnection = await connectAgent({
        serverUrl: `ws://127.0.0.1:${server.getPort()}`,
        device: {
          id: "notebook-2",
          name: "Notebook 2 Renovado",
          hostname: "notebook-2-renovado.local"
        },
        heartbeatIntervalMs: 40
      });

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2 Renovado",
            hostname: "notebook-2-renovado.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
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

  it("ignores heartbeat from stale socket and times out the active socket", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0,
      heartbeatTimeoutMs: 150
    });
    await server.start();

    const staleSocket = new WebSocket(`ws://127.0.0.1:${server.getPort()}`);
    const activeSocket = new WebSocket(`ws://127.0.0.1:${server.getPort()}`);
    let heartbeatInterval: NodeJS.Timeout | undefined;

    try {
      await waitForOpen(staleSocket);
      await sendMessage(
        staleSocket,
        JSON.stringify(
          createAgentRegisterMessage({
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          })
        )
      );

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

      await waitForOpen(activeSocket);
      await sendMessage(
        activeSocket,
        JSON.stringify(
          createAgentRegisterMessage({
            id: "notebook-2",
            name: "Notebook 2 Ativo",
            hostname: "notebook-2-ativo.local",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          })
        )
      );

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2 Ativo",
            hostname: "notebook-2-ativo.local",
            status: "online",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      });

      heartbeatInterval = setInterval(() => {
        if (staleSocket.readyState !== WebSocket.OPEN) {
          return;
        }

        void sendMessage(
          staleSocket,
          JSON.stringify(createAgentHeartbeatMessage({}))
        );
      }, 30);

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "notebook-2",
            name: "Notebook 2 Ativo",
            hostname: "notebook-2-ativo.local",
            status: "offline",
            capabilities: [...DEFAULT_AGENT_CAPABILITIES]
          }
        ]);
      }, 900);
    } finally {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      await closeSocket(activeSocket);
      await closeSocket(staleSocket);
      await server.stop();
    }
  });
});
