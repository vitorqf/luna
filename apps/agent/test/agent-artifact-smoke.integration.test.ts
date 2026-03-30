import { spawn } from "node:child_process";
import {
  cp,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
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

const getLauncherCommand = (
  artifactRoot: string,
): { command: string; args: string[] } => {
  if (process.platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", "run-agent.cmd"],
    };
  }

  return {
    command: join(artifactRoot, "run-agent.sh"),
    args: [],
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
    "bootstraps .env on first run and connects to the server on the second run",
    async () => {
      const workspaceRoot = process.cwd();
      const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
      const tempDir = await mkdtemp(join(tmpdir(), "luna-agent-artifact-"));
      const isolatedArtifactRoot = join(tempDir, "agent");

      let server:
        | {
            stop: () => Promise<void>;
            getPort: () => number;
            getRegisteredDevices: () => unknown[];
          }
        | undefined;
      let agentProcess: ReturnType<typeof spawn> | undefined;

      try {
        await runCommand(npmCommand, ["run", "build:artifact:agent"], {
          cwd: workspaceRoot,
          timeoutMs: 240_000,
        });

        await cp(join(workspaceRoot, "dist-artifacts/agent"), isolatedArtifactRoot, {
          recursive: true,
        });

        const launcherCommand = getLauncherCommand(isolatedArtifactRoot);
        const firstRun = await runCommand(
          launcherCommand.command,
          launcherCommand.args,
          {
            cwd: isolatedArtifactRoot,
            timeoutMs: 30_000,
            expectedExitCodes: [1],
          },
        );

        const envExample = await readFile(
          join(isolatedArtifactRoot, ".env.example"),
          "utf-8",
        );
        await expect(
          readFile(join(isolatedArtifactRoot, ".env"), "utf-8"),
        ).resolves.toBe(envExample);
        expect(`${firstRun.stdout}\n${firstRun.stderr}`).toContain(
          "LUNA_AGENT_SERVER_URL",
        );

        server = createLunaServer({
          host: "127.0.0.1",
          port: 0,
        });
        await server.start();

        await writeFile(
          join(isolatedArtifactRoot, ".env"),
          [
            `LUNA_AGENT_SERVER_URL=ws://127.0.0.1:${server.getPort()}`,
            "LUNA_AGENT_DEVICE_ID=artifact-agent",
            "LUNA_AGENT_DEVICE_NAME=Artifact Agent",
            "LUNA_AGENT_DEVICE_HOSTNAME=artifact-agent.local",
          ].join("\n"),
          "utf-8",
        );

        agentProcess = spawn(launcherCommand.command, launcherCommand.args, {
          cwd: isolatedArtifactRoot,
          stdio: ["ignore", "pipe", "pipe"],
        });

        await waitForAssertion(() => {
          expect(server?.getRegisteredDevices()).toEqual([
            {
              id: "artifact-agent",
              name: "Artifact Agent",
              hostname: "artifact-agent.local",
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
      }
    },
    300_000,
  );
});
