import { createSocket } from "node:dgram";
import { describe, expect, it } from "vitest";
import { createAgentDiscoveryAnnounceMessage } from "@luna/protocol";
import { createLunaServer } from "../src/index";

const sendUdpMessage = async (
  host: string,
  port: number,
  payload: unknown
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
      }
    );
  });
};

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

describe("slice 24 - agent discovery", () => {
  it("lists discovered agents via GET /discovery/agents", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      await sendUdpMessage(
        "127.0.0.1",
        server.getPort(),
        createAgentDiscoveryAnnounceMessage({
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify", "open_app"]
        })
      );

      await waitForAssertion(() => {
        expect(server.getDiscoveredAgents()).toEqual([
          {
            id: "notebook-2",
            hostname: "notebook-2.local",
            capabilities: ["notify", "open_app"]
          }
        ]);
      });

      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/discovery/agents`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([
        {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify", "open_app"]
        }
      ]);
    } finally {
      await server.stop();
    }
  });

  it("approves a discovered agent and moves it to registered devices", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      await sendUdpMessage(
        "127.0.0.1",
        server.getPort(),
        createAgentDiscoveryAnnounceMessage({
          id: "mini-pc-1",
          hostname: "mini-pc-1.local",
          capabilities: ["notify"]
        })
      );

      await waitForAssertion(() => {
        expect(server.getDiscoveredAgents()).toEqual([
          {
            id: "mini-pc-1",
            hostname: "mini-pc-1.local",
            capabilities: ["notify"]
          }
        ]);
      });

      const approveResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/discovery/agents/mini-pc-1/approve`,
        {
          method: "POST"
        }
      );

      expect(approveResponse.status).toBe(200);
      await expect(approveResponse.json()).resolves.toEqual({
        id: "mini-pc-1",
        name: "mini-pc-1.local",
        hostname: "mini-pc-1.local",
        status: "offline",
        capabilities: ["notify"]
      });

      expect(server.getDiscoveredAgents()).toEqual([]);
      expect(server.getRegisteredDevices()).toEqual([
        {
          id: "mini-pc-1",
          name: "mini-pc-1.local",
          hostname: "mini-pc-1.local",
          status: "offline",
          capabilities: ["notify"]
        }
      ]);
    } finally {
      await server.stop();
    }
  });

  it("returns 404 when approving an unknown discovered agent", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/discovery/agents/missing/approve`,
        {
          method: "POST"
        }
      );

      expect(response.status).toBe(404);
      await expect(response.json()).resolves.toEqual({
        message: "Discovered agent not found."
      });
    } finally {
      await server.stop();
    }
  });

  it("does not re-list approved device in discovery after new announce", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const payload = createAgentDiscoveryAnnounceMessage({
        id: "notebook-2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app"]
      });

      await sendUdpMessage("127.0.0.1", server.getPort(), payload);

      await waitForAssertion(() => {
        expect(server.getDiscoveredAgents()).toEqual([
          {
            id: "notebook-2",
            hostname: "notebook-2.local",
            capabilities: ["notify", "open_app"]
          }
        ]);
      });

      const approveResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/discovery/agents/notebook-2/approve`,
        {
          method: "POST"
        }
      );
      expect(approveResponse.status).toBe(200);

      await waitForAssertion(() => {
        expect(server.getDiscoveredAgents()).toEqual([]);
      });

      for (let index = 0; index < 5; index += 1) {
        await sendUdpMessage("127.0.0.1", server.getPort(), payload);
        await sleep(20);
      }

      await waitForAssertion(() => {
        expect(server.getDiscoveredAgents()).toEqual([]);
      });
    } finally {
      await server.stop();
    }
  });
});
