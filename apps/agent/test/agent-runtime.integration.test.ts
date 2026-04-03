import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { hostname as getHostname } from "node:os";
import { join } from "node:path";
import { createLunaServer } from "../../server/src/index";
import {
  loadAgentRuntimeEnvFromFile,
  parseAgentRuntimeCliArgs,
  parseAgentRuntimeConfig,
  startAgentRuntimeFromEnv
} from "../src/main";

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

describe("slice 9 - agent runtime", () => {
  it("parses cli args for server and device overrides", () => {
    const cliArgs = parseAgentRuntimeCliArgs([
      "--server-host",
      "192.168.0.20",
      "--server-port",
      "4100",
      "--device-id",
      "cli-device",
      "--device-name",
      "CLI Device",
      "--device-hostname",
      "cli-device.local"
    ]);

    expect(cliArgs).toEqual({
      serverHost: "192.168.0.20",
      serverPort: 4100,
      deviceId: "cli-device",
      deviceName: "CLI Device",
      deviceHostname: "cli-device.local"
    });
  });

  it("loads agent runtime env values from a .env file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-agent-env-"));
    const envFilePath = join(tempDir, ".env");

    try {
      await writeFile(
        envFilePath,
        [
          "LUNA_AGENT_SERVER_URL=ws://127.0.0.1:4010",
          "LUNA_AGENT_DEVICE_ID=from-env-file",
          "LUNA_AGENT_DEVICE_NAME=From Env File",
          "LUNA_AGENT_DEVICE_HOSTNAME=from-env-file.local"
        ].join("\n"),
        "utf-8"
      );

      const targetEnv: Record<string, string | undefined> = {};
      loadAgentRuntimeEnvFromFile(envFilePath, targetEnv);

      expect(targetEnv.LUNA_AGENT_SERVER_URL).toBe("ws://127.0.0.1:4010");
      expect(targetEnv.LUNA_AGENT_DEVICE_ID).toBe("from-env-file");
      expect(targetEnv.LUNA_AGENT_DEVICE_NAME).toBe("From Env File");
      expect(targetEnv.LUNA_AGENT_DEVICE_HOSTNAME).toBe(
        "from-env-file.local"
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses default runtime config when env vars are not provided", () => {
    const localHostname = getHostname();
    const config = parseAgentRuntimeConfig({});

    expect(config).toEqual({
      serverUrl: "ws://127.0.0.1:4000",
      device: {
        id: localHostname,
        name: localHostname,
        hostname: localHostname
      }
    });
  });

  it("uses hostname as fallback name when only hostname is provided", () => {
    const config = parseAgentRuntimeConfig({
      LUNA_AGENT_DEVICE_HOSTNAME: "my-host.local"
    });

    expect(config.device).toEqual({
      id: getHostname(),
      name: "my-host.local",
      hostname: "my-host.local"
    });
  });

  it("throws when server url protocol is not ws/wss", () => {
    expect(() =>
      parseAgentRuntimeConfig({
        LUNA_AGENT_SERVER_URL: "http://127.0.0.1:4000"
      })
    ).toThrowError("LUNA_AGENT_SERVER_URL must start with ws:// or wss://.");
  });

  it("starts runtime from env and registers a device on the server", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0
    });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await startAgentRuntimeFromEnv({
        LUNA_AGENT_SERVER_URL: `ws://127.0.0.1:${server.getPort()}`,
        LUNA_AGENT_DEVICE_ID: "notebook-2",
        LUNA_AGENT_DEVICE_NAME: "Notebook 2",
        LUNA_AGENT_DEVICE_HOSTNAME: "notebook-2.local"
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
    } finally {
      if (agentConnection) {
        await agentConnection.disconnect();
      }

      await server.stop();
    }
  });

  it("prioritizes cli server settings over env url", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0
    });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await startAgentRuntimeFromEnv(
        {
          LUNA_AGENT_SERVER_URL: "ws://127.0.0.1:65535",
          LUNA_AGENT_DEVICE_ID: "cli-priority-agent",
          LUNA_AGENT_DEVICE_NAME: "CLI Priority Agent",
          LUNA_AGENT_DEVICE_HOSTNAME: "cli-priority-agent.local"
        },
        console,
        ["--server-host", "127.0.0.1", "--server-port", String(server.getPort())]
      );

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "cli-priority-agent",
            name: "CLI Priority Agent",
            hostname: "cli-priority-agent.local",
            status: "online",
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

  it("starts runtime from cli server args when env server url is not provided", async () => {
    const server = createLunaServer({
      host: "127.0.0.1",
      port: 0
    });
    await server.start();

    let agentConnection: { disconnect: () => Promise<void> } | undefined;

    try {
      agentConnection = await startAgentRuntimeFromEnv(
        {
          LUNA_AGENT_DEVICE_ID: "cli-only-agent",
          LUNA_AGENT_DEVICE_NAME: "CLI Only Agent",
          LUNA_AGENT_DEVICE_HOSTNAME: "cli-only-agent.local"
        },
        console,
        ["--server-host", "127.0.0.1", "--server-port", String(server.getPort())]
      );

      await waitForAssertion(() => {
        expect(server.getRegisteredDevices()).toEqual([
          {
            id: "cli-only-agent",
            name: "CLI Only Agent",
            hostname: "cli-only-agent.local",
            status: "online",
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
});
