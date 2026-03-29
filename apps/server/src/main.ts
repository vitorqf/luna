import { pathToFileURL } from "node:url";
import { config as loadDotEnv } from "dotenv";
import { createLunaServer, type LunaServer } from "./index";

const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 4000;

interface RuntimeLogger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export interface ServerRuntimeConfig {
  host: string;
  port: number;
}

const parseHost = (value: string | undefined): string => {
  const normalized = value?.trim();
  if (!normalized) {
    return DEFAULT_HOST;
  }

  return normalized;
};

const parsePort = (value: string | undefined): number => {
  const normalized = value?.trim();
  if (!normalized) {
    return DEFAULT_PORT;
  }

  const parsedPort = Number.parseInt(normalized, 10);
  if (!Number.isInteger(parsedPort) || parsedPort < 0 || parsedPort > 65_535) {
    throw new Error("LUNA_SERVER_PORT must be an integer between 0 and 65535.");
  }

  return parsedPort;
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

export const parseServerRuntimeConfig = (
  env: NodeJS.ProcessEnv = process.env
): ServerRuntimeConfig => ({
  host: parseHost(env.LUNA_SERVER_HOST),
  port: parsePort(env.LUNA_SERVER_PORT)
});

export const loadServerRuntimeEnvFromFile = (
  envFilePath = ".env",
  targetEnv: NodeJS.ProcessEnv = process.env
): void => {
  loadDotEnv({
    path: envFilePath,
    processEnv: targetEnv,
    override: false,
    quiet: true
  });
};

export const startServerRuntimeFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  logger: RuntimeLogger = console
): Promise<LunaServer> => {
  const runtimeConfig = parseServerRuntimeConfig(env);
  const server = createLunaServer(runtimeConfig);
  await server.start();

  logger.info(
    `[luna][server] listening on http://${runtimeConfig.host}:${server.getPort()}`
  );

  return server;
};

export const runServerMain = async (
  env: NodeJS.ProcessEnv = process.env,
  logger: RuntimeLogger = console
): Promise<void> => {
  const server = await startServerRuntimeFromEnv(env, logger);

  try {
    const signal = await waitForShutdownSignal();
    logger.info(`[luna][server] received ${signal}, shutting down.`);
  } finally {
    await server.stop();
  }
};

if (isMainModule(import.meta.url)) {
  loadServerRuntimeEnvFromFile();
  void runServerMain().catch((error) => {
    const message =
      error instanceof Error ? error.message : "Unknown server runtime failure.";
    console.error(`[luna][server] failed to start: ${message}`);
    process.exitCode = 1;
  });
}
