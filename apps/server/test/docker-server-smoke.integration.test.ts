import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createServer } from "node:net";
import { describe, expect, it } from "vitest";

const DOCKERFILE_PATH = "apps/server/Dockerfile";

const isDockerAvailable = (): boolean => {
  const result = spawnSync("docker", ["--version"], {
    stdio: "ignore"
  });

  if (result.error) {
    return false;
  }

  return result.status === 0;
};

const runCommand = async (
  command: string,
  args: string[],
  options: {
    cwd: string;
    timeoutMs?: number;
  }
): Promise<{ stdout: string; stderr: string }> =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"]
    });
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const timeoutHandle = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Command timed out: ${command} ${args.join(" ")}`));
    }, options.timeoutMs ?? 240_000);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutChunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : chunk
      );
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderrChunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : chunk
      );
    });

    child.once("error", (error) => {
      clearTimeout(timeoutHandle);
      reject(error);
    });

    child.once("close", (code) => {
      clearTimeout(timeoutHandle);
      const stdout = Buffer.concat(stdoutChunks).toString("utf-8");
      const stderr = Buffer.concat(stderrChunks).toString("utf-8");

      if (code !== 0) {
        reject(
          new Error(
            `Command failed with code ${code}: ${command} ${args.join(" ")}\n${stderr}`
          )
        );
        return;
      }

      resolve({ stdout, stderr });
    });
  });

const getAvailablePort = async (): Promise<number> =>
  new Promise<number>((resolve, reject) => {
    const probe = createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (!address || typeof address === "string") {
        reject(new Error("Unable to resolve an available port."));
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
  });

const waitForSuccessfulResponse = async (
  url: string,
  timeoutMs: number
): Promise<Response> => {
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return response;
      }

      lastError = new Error(`Unexpected status ${response.status} for ${url}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}.`);
};

describe("slice 36 - docker server distribution", () => {
  it(
    "builds the docker image and serves web plus REST using runtime env vars",
    async (context) => {
      if (!isDockerAvailable()) {
        context.skip("Docker CLI is not available in this environment.");
      }

      const workspaceRoot = process.cwd();
      const imageTag = `luna-server-smoke:${randomUUID().slice(0, 8)}`;
      const containerName = `luna-server-smoke-${randomUUID().slice(0, 8)}`;
      const hostPort = await getAvailablePort();

      try {
        await runCommand(
          "docker",
          ["build", "-f", DOCKERFILE_PATH, "-t", imageTag, "."],
          {
            cwd: workspaceRoot,
            timeoutMs: 480_000
          }
        );

        await runCommand(
          "docker",
          [
            "run",
            "--detach",
            "--rm",
            "--name",
            containerName,
            "--publish",
            `127.0.0.1:${hostPort}:${hostPort}`,
            "--env",
            `LUNA_SERVER_PORT=${hostPort}`,
            imageTag
          ],
          {
            cwd: workspaceRoot,
            timeoutMs: 60_000
          }
        );

        const devicesResponse = await waitForSuccessfulResponse(
          `http://127.0.0.1:${hostPort}/devices`,
          60_000
        );
        await expect(devicesResponse.json()).resolves.toEqual([]);

        const homeResponse = await waitForSuccessfulResponse(
          `http://127.0.0.1:${hostPort}/`,
          10_000
        );
        expect(homeResponse.headers.get("content-type")).toContain("text/html");
        await expect(homeResponse.text()).resolves.toContain("Luna");
      } finally {
        await runCommand(
          "docker",
          ["rm", "--force", containerName],
          {
            cwd: workspaceRoot,
            timeoutMs: 30_000
          }
        ).catch(() => undefined);
        await runCommand(
          "docker",
          ["image", "rm", imageTag],
          {
            cwd: workspaceRoot,
            timeoutMs: 60_000
          }
        ).catch(() => undefined);
      }
    },
    600_000
  );
});
