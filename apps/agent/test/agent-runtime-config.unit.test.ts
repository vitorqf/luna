import { hostname as getHostname } from "node:os";
import { describe, expect, it } from "vitest";
import {
  parseAgentRuntimeCliArgs,
  parseAgentRuntimeConfig,
  parseAgentRuntimeReconnectConfig,
  resolveAgentRuntimeConfig,
} from "../src/agent-runtime-config";

describe("agent runtime config", () => {
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
      "cli-device.local",
    ]);

    expect(cliArgs).toEqual({
      serverHost: "192.168.0.20",
      serverPort: 4100,
      deviceId: "cli-device",
      deviceName: "CLI Device",
      deviceHostname: "cli-device.local",
    });
  });

  it("throws when cli server port is invalid", () => {
    expect(() =>
      parseAgentRuntimeCliArgs(["--server-port", "70000"]),
    ).toThrowError("--server-port must be an integer between 1 and 65535.");
  });

  it("throws for unknown cli arguments", () => {
    expect(() =>
      parseAgentRuntimeCliArgs(["--not-supported"]),
    ).toThrowError("Unknown CLI argument: --not-supported");
  });

  it("uses default runtime config when env vars are not provided", () => {
    const localHostname = getHostname();
    const config = parseAgentRuntimeConfig({});

    expect(config).toEqual({
      serverUrl: "ws://127.0.0.1:4000",
      device: {
        id: localHostname,
        name: localHostname,
        hostname: localHostname,
      },
    });
  });

  it("uses hostname as fallback name when only hostname is provided", () => {
    const config = parseAgentRuntimeConfig({
      LUNA_AGENT_DEVICE_HOSTNAME: "my-host.local",
    });

    expect(config.device).toEqual({
      id: getHostname(),
      name: "my-host.local",
      hostname: "my-host.local",
    });
  });

  it("throws when server url protocol is not ws or wss", () => {
    expect(() =>
      parseAgentRuntimeConfig({
        LUNA_AGENT_SERVER_URL: "http://127.0.0.1:4000",
      }),
    ).toThrowError("LUNA_AGENT_SERVER_URL must start with ws:// or wss://.");
  });

  it("uses reconnect defaults when env vars are not provided", () => {
    expect(parseAgentRuntimeReconnectConfig({})).toEqual({
      initialDelayMs: 1_000,
      maxDelayMs: 30_000,
    });
  });

  it("throws when reconnect delays are invalid", () => {
    expect(() =>
      parseAgentRuntimeReconnectConfig({
        LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS: "0",
      }),
    ).toThrowError(
      "LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS must be a positive integer.",
    );

    expect(() =>
      parseAgentRuntimeReconnectConfig({
        LUNA_AGENT_RECONNECT_MAX_DELAY_MS: "abc",
      }),
    ).toThrowError(
      "LUNA_AGENT_RECONNECT_MAX_DELAY_MS must be a positive integer.",
    );

    expect(() =>
      parseAgentRuntimeReconnectConfig({
        LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS: "5000",
        LUNA_AGENT_RECONNECT_MAX_DELAY_MS: "2000",
      }),
    ).toThrowError(
      "LUNA_AGENT_RECONNECT_MAX_DELAY_MS must be greater than or equal to LUNA_AGENT_RECONNECT_INITIAL_DELAY_MS.",
    );
  });

  it("prioritizes --server-url over env and other cli host overrides", () => {
    const config = resolveAgentRuntimeConfig(
      {
        LUNA_AGENT_SERVER_URL: "wss://env-host:443",
      },
      {
        serverUrl: "ws://cli-url:4100",
        serverHost: "ignored-host",
        serverPort: 4200,
      },
    );

    expect(config.serverUrl).toBe("ws://cli-url:4100");
  });

  it("overlays cli host and port on the env server url", () => {
    const config = resolveAgentRuntimeConfig(
      {
        LUNA_AGENT_SERVER_URL: "wss://env-host:443",
      },
      {
        serverHost: "cli-host",
        serverPort: 4200,
      },
    );

    expect(config.serverUrl).toBe("wss://cli-host:4200");
  });

  it("uses the default server url as base when env server url is absent", () => {
    const localHostname = getHostname();
    const config = resolveAgentRuntimeConfig(
      {},
      {
        serverHost: "cli-host",
        serverPort: 4200,
      },
    );

    expect(config).toEqual({
      serverUrl: "ws://cli-host:4200",
      device: {
        id: localHostname,
        name: localHostname,
        hostname: localHostname,
      },
      reconnect: {
        initialDelayMs: 1_000,
        maxDelayMs: 30_000,
      },
    });
  });

  it("uses cli hostname as fallback device name when cli name is absent", () => {
    const config = resolveAgentRuntimeConfig(
      {
        LUNA_AGENT_DEVICE_NAME: "Env Device Name",
      },
      {
        deviceHostname: "cli-device.local",
      },
    );

    expect(config.device).toEqual({
      id: getHostname(),
      name: "cli-device.local",
      hostname: "cli-device.local",
    });
  });
});
