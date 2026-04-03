import { pathToFileURL } from "node:url";
import {
  connectAgent,
  type AgentConnection,
} from "./index";
import { loadAgentRuntimeEnvFromFile } from "./agent-runtime-env";
import {
  parseAgentRuntimeCliArgs,
  parseAgentRuntimeConfig,
  parseAgentRuntimeReconnectConfig,
  resolveAgentRuntimeConfig,
  type RuntimeEnv,
} from "./agent-runtime-config";

interface RuntimeLogger {
  info: (message: string) => void;
  error: (message: string) => void;
}

export { loadAgentRuntimeEnvFromFile } from "./agent-runtime-env";
export {
  parseAgentRuntimeCliArgs,
  parseAgentRuntimeConfig,
  parseAgentRuntimeReconnectConfig,
} from "./agent-runtime-config";

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

export const startAgentRuntimeFromEnv = async (
  env: RuntimeEnv = process.env,
  logger: RuntimeLogger = console,
  cliArgv: string[] = process.argv.slice(2),
): Promise<AgentConnection> => {
  const cliArgs = parseAgentRuntimeCliArgs(cliArgv);
  const runtimeConfig = resolveAgentRuntimeConfig(env, cliArgs);
  let activeConnection: AgentConnection | undefined;
  let reconnectDelayMs = runtimeConfig.reconnect.initialDelayMs;
  let reconnectTimer: NodeJS.Timeout | undefined;
  let connectAttempt: Promise<void> | undefined;
  let isStopping = false;

  const clearReconnectTimer = (): void => {
    if (!reconnectTimer) {
      return;
    }

    clearTimeout(reconnectTimer);
    reconnectTimer = undefined;
  };

  const getNextReconnectDelayMs = (delayMs: number): number =>
    Math.min(delayMs * 2, runtimeConfig.reconnect.maxDelayMs);

  const scheduleReconnect = (delayMs: number): void => {
    if (isStopping) {
      return;
    }

    clearReconnectTimer();
    reconnectTimer = setTimeout(() => {
      reconnectTimer = undefined;
      void ensureConnected();
    }, delayMs);
  };

  const scheduleReconnectAndIncreaseDelay = (
    error: unknown,
    context: "connection failed" | "connection closed",
  ): void => {
    const retryDelayMs = reconnectDelayMs;
    reconnectDelayMs = getNextReconnectDelayMs(reconnectDelayMs);
    const reason =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : "Unknown connection error.";
    logger.error(
      `[luna][agent] ${context}: ${reason}. Retrying in ${retryDelayMs}ms.`,
    );
    scheduleReconnect(retryDelayMs);
  };

  const ensureConnected = async (): Promise<void> => {
    if (isStopping || activeConnection || connectAttempt) {
      return;
    }

    const attempt = (async () => {
      try {
        const connectedAgent = await connectAgent({
          serverUrl: runtimeConfig.serverUrl,
          device: runtimeConfig.device,
          onDisconnect: () => {
            activeConnection = undefined;
            if (isStopping) {
              return;
            }

            scheduleReconnectAndIncreaseDelay(
              new Error("WebSocket closed"),
              "connection closed",
            );
          },
        });

        if (isStopping) {
          await connectedAgent.disconnect();
          return;
        }

        activeConnection = connectedAgent;
        reconnectDelayMs = runtimeConfig.reconnect.initialDelayMs;
        logger.info(
          `[luna][agent] connected as ${runtimeConfig.device.id} to ${runtimeConfig.serverUrl}`,
        );
      } catch (error) {
        if (isStopping) {
          return;
        }

        scheduleReconnectAndIncreaseDelay(error, "connection failed");
      } finally {
        connectAttempt = undefined;
      }
    })();

    connectAttempt = attempt;
    await attempt;
  };

  void ensureConnected();

  return {
    disconnect: async () => {
      if (isStopping) {
        return;
      }

      isStopping = true;
      clearReconnectTimer();

      const pendingConnectAttempt = connectAttempt;
      const connectionToClose = activeConnection;
      activeConnection = undefined;

      if (connectionToClose) {
        await connectionToClose.disconnect();
      }

      if (pendingConnectAttempt) {
        await pendingConnectAttempt.catch(() => undefined);
      }
    },
  };
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
