import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLunaServer } from "../../server/src/index";
import { buildAgentNpmPackage } from "../src/build-npm-package";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForAssertion = async (
  assertion: () => void,
  timeoutMs = 15_000,
): Promise<void> => {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await sleep(75);
    }
  }

  throw lastError ?? new Error("Timed out waiting for assertion.");
};

const terminateChild = async (
  child: ReturnType<typeof spawn>,
  timeoutMs = 10_000,
): Promise<void> => {
  if (child.killed || child.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeoutHandle = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Timed out waiting for child process shutdown."));
    }, timeoutMs);

    child.once("close", () => {
      clearTimeout(timeoutHandle);
      resolve();
    });

    child.kill("SIGTERM");
  }).catch(() => undefined);
};

const getPackagedCliCommand = (
  packageRoot: string,
  serverPort: number,
): { command: string; args: string[] } => {
  return {
    command: process.execPath,
    args: [
      join(packageRoot, "bin", "luna-agent.js"),
      "--server-host",
      "127.0.0.1",
      "--server-port",
      String(serverPort),
      "--device-id",
      "npm-cli-agent",
      "--device-name",
      "Npm CLI Agent",
      "--device-hostname",
      "npm-cli-agent.local",
    ],
  };
};

describe("slice 49 - agent npm package smoke", () => {
  it(
    "builds npm cli package and runs the generated bin",
    async () => {
      const workspaceRoot = process.cwd();
      const outputRootDirName = `dist-packages-smoke-${randomUUID().slice(0, 8)}`;
      const outputDirName = `${outputRootDirName}/agent-cli`;
      const packageRoot = join(workspaceRoot, outputDirName);

      let server:
        | {
            start: () => Promise<void>;
            stop: () => Promise<void>;
            getPort: () => number;
            getRegisteredDevices: () => unknown[];
          }
        | undefined;
      let cliProcess: ReturnType<typeof spawn> | undefined;
      let cliStdout = "";
      let cliStderr = "";

      try {
        await buildAgentNpmPackage({
          projectRoot: workspaceRoot,
          outputDirName,
        });

        server = createLunaServer({
          host: "127.0.0.1",
          port: 0,
        });
        await server.start();

        const cliCommand = getPackagedCliCommand(packageRoot, server.getPort());
        cliProcess = spawn(cliCommand.command, cliCommand.args, {
          cwd: workspaceRoot,
          stdio: ["ignore", "pipe", "pipe"],
        });
        cliProcess.stdout.on("data", (chunk: Buffer | string) => {
          cliStdout += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        });
        cliProcess.stderr.on("data", (chunk: Buffer | string) => {
          cliStderr += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
        });

        await waitForAssertion(() => {
          if (cliProcess && cliProcess.exitCode !== null && cliProcess.exitCode !== 0) {
            throw new Error(
              `npm package cli exited with code ${cliProcess.exitCode}\n${cliStdout}\n${cliStderr}`,
            );
          }
          expect(server?.getRegisteredDevices()).toEqual([
            {
              id: "npm-cli-agent",
              name: "Npm CLI Agent",
              hostname: "npm-cli-agent.local",
              status: "online",
              capabilities: ["notify", "open_app", "set_volume", "play_media"],
            },
          ]);
        });
      } finally {
        if (cliProcess) {
          await terminateChild(cliProcess);
        }

        if (server) {
          await server.stop();
        }

        await rm(join(workspaceRoot, outputRootDirName), {
          recursive: true,
          force: true,
        }).catch(() => undefined);
      }
    },
    300_000,
  );
});
