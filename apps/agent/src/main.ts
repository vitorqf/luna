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
): Promise<AgentConnection> => {
  const runtimeConfig = parseAgentRuntimeConfig(env);

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
): Promise<void> => {
  const connection = await startAgentRuntimeFromEnv(env, logger);

  try {
    const signal = await waitForShutdownSignal();
    logger.info(`[luna][agent] received ${signal}, disconnecting.`);
  } finally {
    await connection.disconnect();
  }
};

if (isMainModule(import.meta.url)) {
  loadAgentRuntimeEnvFromFile();
  void runAgentMain().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unknown agent runtime failure.";
    console.error(`[luna][agent] failed to start: ${message}`);
    process.exitCode = 1;
  });
}
