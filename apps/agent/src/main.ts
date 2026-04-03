import { pathToFileURL } from "node:url";
import { hostname as getHostname } from "node:os";
import { config as loadDotEnv } from "dotenv";
import {
  connectAgent,
  type AgentConnection,
  type AgentIdentity,
} from "./index";

const DEFAULT_SERVER_URL = "ws://127.0.0.1:4000";

interface RuntimeLogger {
  info: (message: string) => void;
  error: (message: string) => void;
}

type RuntimeEnv = Record<string, string | undefined>;

export interface AgentRuntimeCliArgs {
  serverUrl?: string;
  serverHost?: string;
  serverPort?: number;
  deviceId?: string;
  deviceName?: string;
  deviceHostname?: string;
}

export interface AgentRuntimeConfig {
  serverUrl: string;
  device: AgentIdentity;
}

const parseNonEmptyString = (
  value: string | undefined,
  fallback: string,
): string => {
  const normalized = value?.trim();
  if (!normalized) {
    return fallback;
  }

  return normalized;
};

const parseServerUrl = (value: string | undefined): string => {
  const normalized = parseNonEmptyString(value, DEFAULT_SERVER_URL);

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("LUNA_AGENT_SERVER_URL must start with ws:// or wss://.");
  }

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("LUNA_AGENT_SERVER_URL must start with ws:// or wss://.");
  }

  return normalized;
};

const parseCliNonEmptyValue = (
  option: string,
  value: string | undefined,
): string => {
  const normalized = value?.trim();
  if (!normalized) {
    throw new Error(`${option} requires a non-empty value.`);
  }

  return normalized;
};

const parseCliPort = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error("--server-port must be an integer between 1 and 65535.");
  }

  return parsed;
};

export const parseAgentRuntimeCliArgs = (
  argv: string[] = process.argv.slice(2),
): AgentRuntimeCliArgs => {
  const cliArgs: AgentRuntimeCliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (!argument) {
      continue;
    }

    if (argument === "--server-url") {
      cliArgs.serverUrl = parseCliNonEmptyValue("--server-url", argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--server-host") {
      cliArgs.serverHost = parseCliNonEmptyValue("--server-host", argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--server-port") {
      const value = parseCliNonEmptyValue("--server-port", argv[index + 1]);
      cliArgs.serverPort = parseCliPort(value);
      index += 1;
      continue;
    }

    if (argument === "--device-id") {
      cliArgs.deviceId = parseCliNonEmptyValue("--device-id", argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--device-name") {
      cliArgs.deviceName = parseCliNonEmptyValue("--device-name", argv[index + 1]);
      index += 1;
      continue;
    }

    if (argument === "--device-hostname") {
      cliArgs.deviceHostname = parseCliNonEmptyValue(
        "--device-hostname",
        argv[index + 1],
      );
      index += 1;
      continue;
    }

    if (argument.startsWith("--")) {
      throw new Error(`Unknown CLI argument: ${argument}`);
    }
  }

  return cliArgs;
};

const parseWsPort = (url: URL): number => {
  if (!url.port) {
    return url.protocol === "wss:" ? 443 : 80;
  }

  return Number.parseInt(url.port, 10);
};

const resolveRuntimeConfig = (
  env: RuntimeEnv,
  cliArgs: AgentRuntimeCliArgs,
): AgentRuntimeConfig => {
  const parsedFromEnv = parseAgentRuntimeConfig(env);
  const envServerUrl = parseServerUrl(env.LUNA_AGENT_SERVER_URL);
  const parsedEnvServerUrl = new URL(envServerUrl);
  const parsedDefaultServerUrl = new URL(DEFAULT_SERVER_URL);

  let serverUrl = parsedFromEnv.serverUrl;
  if (cliArgs.serverUrl) {
    serverUrl = parseServerUrl(cliArgs.serverUrl);
  } else if (cliArgs.serverHost || cliArgs.serverPort !== undefined) {
    const protocol = parsedEnvServerUrl.protocol;
    const serverHost = cliArgs.serverHost ?? parsedEnvServerUrl.hostname;
    const serverPort = cliArgs.serverPort ?? parseWsPort(parsedEnvServerUrl);
    serverUrl = `${protocol}//${serverHost}:${serverPort}`;
  } else if (!env.LUNA_AGENT_SERVER_URL?.trim()) {
    serverUrl = `${parsedDefaultServerUrl.protocol}//${parsedDefaultServerUrl.hostname}:${parseWsPort(parsedDefaultServerUrl)}`;
  }

  const deviceHostname = cliArgs.deviceHostname ?? parsedFromEnv.device.hostname;

  return {
    serverUrl,
    device: {
      id: cliArgs.deviceId ?? parsedFromEnv.device.id,
      name:
        cliArgs.deviceName ??
        (cliArgs.deviceHostname ? deviceHostname : parsedFromEnv.device.name),
      hostname: deviceHostname,
    },
  };
};

const waitForShutdownSignal = (): Promise<NodeJS.Signals> =>
  new Promise((resolve) => {
    process.once("SIGINT", () => resolve("SIGINT"));
    process.once("SIGTERM", () => resolve("SIGTERM"));
  });

const isMainModule = (moduleUrl: string): boolean => {
  const runtimeEntryPath = process.argv[1];
  if (!runtimeEntryPath) {
    return false;
  }

  return moduleUrl === pathToFileURL(runtimeEntryPath).href;
};

export const parseAgentRuntimeConfig = (
  env: RuntimeEnv = process.env,
): AgentRuntimeConfig => {
  const defaultHostname = getHostname();
  const deviceHostname = parseNonEmptyString(
    env.LUNA_AGENT_DEVICE_HOSTNAME,
    defaultHostname,
  );

  return {
    serverUrl: parseServerUrl(env.LUNA_AGENT_SERVER_URL),
    device: {
      id: parseNonEmptyString(env.LUNA_AGENT_DEVICE_ID, defaultHostname),
      name: parseNonEmptyString(env.LUNA_AGENT_DEVICE_NAME, deviceHostname),
      hostname: deviceHostname,
    },
  };
};

export const loadAgentRuntimeEnvFromFile = (
  envFilePath = ".env",
  targetEnv: RuntimeEnv = process.env,
): void => {
  loadDotEnv({
    path: envFilePath,
    processEnv: targetEnv,
    override: false,
    quiet: true,
  });
};

export const startAgentRuntimeFromEnv = async (
  env: RuntimeEnv = process.env,
  logger: RuntimeLogger = console,
  cliArgv: string[] = process.argv.slice(2),
): Promise<AgentConnection> => {
  const cliArgs = parseAgentRuntimeCliArgs(cliArgv);
  const runtimeConfig = resolveRuntimeConfig(env, cliArgs);

  const connection = await connectAgent({
    serverUrl: runtimeConfig.serverUrl,
    device: runtimeConfig.device,
  });

  logger.info(
    `[luna][agent] connected as ${runtimeConfig.device.id} to ${runtimeConfig.serverUrl}`,
  );

  return connection;
};

export const runAgentMain = async (
  env: RuntimeEnv = process.env,
  logger: RuntimeLogger = console,
  cliArgv: string[] = process.argv.slice(2),
): Promise<void> => {
  const connection = await startAgentRuntimeFromEnv(env, logger, cliArgv);

  try {
    const signal = await waitForShutdownSignal();
    logger.info(`[luna][agent] received ${signal}, disconnecting.`);
  } finally {
    await connection.disconnect();
  }
};

if (isMainModule(import.meta.url)) {
  loadAgentRuntimeEnvFromFile();
  void runAgentMain(process.env, console, process.argv.slice(2)).catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unknown agent runtime failure.";
    console.error(`[luna][agent] failed to start: ${message}`);
    process.exitCode = 1;
  });
}
