import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import {
  cp,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBuildArtifact } from "../../server/src/build-artifacts";
import { createLunaServer } from "../../server/src/index";

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const waitForAssertion = async (
  assertion: () => void,
  timeoutMs = 5_000,
): Promise<void> => {
  const start = Date.now();
  let lastError: unknown;

  while (Date.now() - start < timeoutMs) {
    try {
      assertion();
      return;
    } catch (error) {
      lastError = error;
      await sleep(50);
    }
  }

  throw lastError ?? new Error("Timed out waiting for assertion.");
};

const runCommand = async (
  command: string,
  args: string[],
  options: {
    cwd: string;
    timeoutMs?: number;
    expectedExitCodes?: number[];
  },
): Promise<{ stdout: string; stderr: string; exitCode: number }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timeoutHandle = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, options.timeoutMs ?? 120_000);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timeoutHandle);
      const exitCode = code ?? 1;
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");
      const expectedExitCodes = options.expectedExitCodes ?? [0];

      if (!expectedExitCodes.includes(exitCode)) {
        reject(
          new Error(
            `Command failed with code ${exitCode}: ${command} ${args.join(" ")}\n${stdout}\n${stderr}`,
          ),
        );
        return;
      }

      resolve({ stdout, stderr, exitCode });
    });
  });

const getPackagedRuntimeCommand = (
  artifactRoot: string,
): { command: string; args: string[] } => {
  if (process.platform === "win32") {
    return {
      command: join(artifactRoot, "runtime", "node.exe"),
      args: [join(artifactRoot, "dist", "apps", "agent", "src", "main.js")],
    };
  }

  return {
    command: join(artifactRoot, "runtime", "node"),
    args: [join(artifactRoot, "dist", "apps", "agent", "src", "main.js")],
  };
};

const terminateChild = async (
  child: ReturnType<typeof spawn>,
  timeoutMs = 5_000,
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

describe("slice 38 - agent artifact smoke", () => {
  it(
    "connects using the packaged runtime and cli server args",
    async () => {
      const workspaceRoot = process.cwd();
      const buildCommand =
        process.platform === "win32"
          ? {
              command: "cmd.exe",
              args: ["/d", "/s", "/c", "npm run build"],
            }
          : {
              command: "npm",
              args: ["run", "build"],
            };
      const tempDir = await mkdtemp(join(tmpdir(), "luna-agent-artifact-"));
      const isolatedArtifactRoot = join(tempDir, "agent");
      const smokeArtifactsDirName = `dist-artifacts-smoke-${randomUUID().slice(0, 8)}`;
      const smokeArtifactRoot = join(
        workspaceRoot,
        smokeArtifactsDirName,
        "agent",
      );

      let server:
        | {
            start: () => Promise<void>;
            stop: () => Promise<void>;
            getPort: () => number;
            getRegisteredDevices: () => unknown[];
          }
        | undefined;
      let agentProcess: ReturnType<typeof spawn> | undefined;

      try {
        await runCommand(buildCommand.command, buildCommand.args, {
          cwd: workspaceRoot,
          timeoutMs: 240_000,
        });
        await createBuildArtifact("agent", {
          projectRoot: workspaceRoot,
          artifactsDirName: smokeArtifactsDirName,
        });

        await cp(smokeArtifactRoot, isolatedArtifactRoot, {
          recursive: true,
        });

        const runtimeCommand = getPackagedRuntimeCommand(isolatedArtifactRoot);

        server = createLunaServer({
          host: "127.0.0.1",
          port: 0,
        });
        await server.start();

        agentProcess = spawn(
          runtimeCommand.command,
          [
            ...runtimeCommand.args,
            "--server-host",
            "127.0.0.1",
            "--server-port",
            String(server.getPort()),
            "--device-id",
            "artifact-agent-cli",
            "--device-name",
            "Artifact Agent CLI",
            "--device-hostname",
            "artifact-agent-cli.local",
          ],
          {
            cwd: isolatedArtifactRoot,
            stdio: ["ignore", "pipe", "pipe"],
          },
        );

        await waitForAssertion(() => {
          expect(server?.getRegisteredDevices()).toEqual([
            {
              id: "artifact-agent-cli",
              name: "Artifact Agent CLI",
              hostname: "artifact-agent-cli.local",
              status: "online",
              capabilities: ["notify", "open_app", "set_volume", "play_media"],
            },
          ]);
        });
      } finally {
        if (agentProcess) {
          await terminateChild(agentProcess);
        }

        if (server) {
          await server.stop();
        }

        await rm(tempDir, { recursive: true, force: true });
        await rm(join(workspaceRoot, smokeArtifactsDirName), {
          recursive: true,
          force: true,
        });
      }
    },
    300_000,
  );
});
