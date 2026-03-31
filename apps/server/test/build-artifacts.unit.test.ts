import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBuildArtifact } from "../src/build-artifacts";

const writeFixtureFile = async (
  filePath: string,
  contents = "fixture",
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf-8");
};

const pathExists = async (filePath: string): Promise<boolean> => {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
};

const seedDistFixtures = async (projectRoot: string): Promise<void> => {
  await writeFixtureFile(join(projectRoot, "dist/apps/server/src/main.js"));
  await writeFixtureFile(join(projectRoot, "dist/apps/agent/src/main.js"));
  await writeFixtureFile(
    join(projectRoot, "dist/packages/shared-types/src/index.js"),
  );
  await writeFixtureFile(join(projectRoot, "dist/packages/protocol/src/index.js"));
  await writeFixtureFile(
    join(projectRoot, "dist/packages/command-parser/src/index.js"),
  );
};

const seedEmbeddedWebFixtures = async (projectRoot: string): Promise<void> => {
  await writeFixtureFile(join(projectRoot, "apps/web/out/index.html"));
  await writeFixtureFile(
    join(projectRoot, "apps/web/out/_next/static/chunks/app.js"),
  );
};

const seedExternalRuntimeDependencyFixtures = async (
  projectRoot: string,
): Promise<void> => {
  await writeFixtureFile(
    join(projectRoot, "node_modules/dotenv/package.json"),
    JSON.stringify({
      name: "dotenv",
      type: "module",
      exports: "./config.js",
    }),
  );
  await writeFixtureFile(
    join(projectRoot, "node_modules/dotenv/config.js"),
    "export const config = () => undefined;\n",
  );
  await writeFixtureFile(
    join(projectRoot, "node_modules/ws/package.json"),
    JSON.stringify({
      name: "ws",
      type: "module",
      exports: "./index.js",
    }),
  );
  await writeFixtureFile(
    join(projectRoot, "node_modules/ws/index.js"),
    "export class WebSocket {}\n",
  );
};

const seedRuntimeFixture = async (
  projectRoot: string,
  fileName: string,
): Promise<string> => {
  const runtimeExecutablePath = join(projectRoot, "fixtures", fileName);
  await writeFixtureFile(runtimeExecutablePath, "runtime");
  return runtimeExecutablePath;
};

describe("slice 25 - build artifacts", () => {
  it("creates server artifact without agent files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-server-"));

    try {
      await seedDistFixtures(projectRoot);
      await seedEmbeddedWebFixtures(projectRoot);

      const artifactRoot = await createBuildArtifact("server", { projectRoot });

      await expect(
        pathExists(join(artifactRoot, "dist/apps/server/src/main.js")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "dist/packages/protocol/src/index.js")),
      ).resolves.toBe(true);
      await expect(
        pathExists(
          join(artifactRoot, "dist/packages/command-parser/src/index.js"),
        ),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "web/index.html")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "web/_next/static/chunks/app.js")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "dist/apps/agent/src/main.js")),
      ).resolves.toBe(false);
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("creates a non-windows agent artifact with runtime, external deps and launcher", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-agent-"));

    try {
      await seedDistFixtures(projectRoot);
      await seedExternalRuntimeDependencyFixtures(projectRoot);
      const runtimeExecutablePath = await seedRuntimeFixture(projectRoot, "node");

      const artifactRoot = await createBuildArtifact("agent", {
        projectRoot,
        runtimeExecutablePath,
        targetPlatform: "linux",
      });

      await expect(
        pathExists(join(artifactRoot, "dist/apps/agent/src/main.js")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "dist/packages/protocol/src/index.js")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "dist/apps/server/src/main.js")),
      ).resolves.toBe(false);
      await expect(
        pathExists(
          join(artifactRoot, "dist/packages/command-parser/src/index.js"),
        ),
      ).resolves.toBe(false);
      await expect(
        pathExists(join(artifactRoot, "node_modules/dotenv/package.json")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "node_modules/ws/package.json")),
      ).resolves.toBe(true);
      await expect(
        pathExists(join(artifactRoot, "runtime/node")),
      ).resolves.toBe(true);
      await expect(pathExists(join(artifactRoot, ".env.example"))).resolves.toBe(true);
      await expect(pathExists(join(artifactRoot, "run-agent.sh"))).resolves.toBe(true);
      await expect(pathExists(join(artifactRoot, "run-agent.cmd"))).resolves.toBe(false);

      await expect(
        readFile(join(artifactRoot, ".env.example"), "utf-8"),
      ).resolves.toContain("LUNA_AGENT_SERVER_URL=ws://127.0.0.1:4000");

      const launcherSource = await readFile(
        join(artifactRoot, "run-agent.sh"),
        "utf-8",
      );
      expect(launcherSource).toContain('./runtime/node');
      expect(launcherSource).toContain('./dist/apps/agent/src/main.js');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("creates a windows agent artifact with cmd launcher and node.exe runtime", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-agent-win-"));

    try {
      await seedDistFixtures(projectRoot);
      await seedExternalRuntimeDependencyFixtures(projectRoot);
      const runtimeExecutablePath = await seedRuntimeFixture(projectRoot, "node.exe");

      const artifactRoot = await createBuildArtifact("agent", {
        projectRoot,
        runtimeExecutablePath,
        targetPlatform: "win32",
      });

      await expect(
        pathExists(join(artifactRoot, "runtime/node.exe")),
      ).resolves.toBe(true);
      await expect(pathExists(join(artifactRoot, "run-agent.cmd"))).resolves.toBe(true);
      await expect(pathExists(join(artifactRoot, "run-agent.sh"))).resolves.toBe(false);

      const launcherSource = await readFile(
        join(artifactRoot, "run-agent.cmd"),
        "utf-8",
      );
      expect(launcherSource).toContain('runtime\\node.exe');
      expect(launcherSource).toContain('dist\\apps\\agent\\src\\main.js');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("rewrites relative js imports so the server artifact runs in node esm", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-runtime-"));

    try {
      await seedDistFixtures(projectRoot);
      await seedEmbeddedWebFixtures(projectRoot);
      await writeFixtureFile(
        join(projectRoot, "dist/apps/server/src/main.js"),
        'import "./index";\n',
      );
      await writeFixtureFile(
        join(projectRoot, "dist/apps/server/src/index.js"),
        "export const serverEntry = true;\n",
      );

      const artifactRoot = await createBuildArtifact("server", { projectRoot });
      const artifactEntrySource = await readFile(
        join(artifactRoot, "dist/apps/server/src/main.js"),
        "utf-8",
      );

      expect(artifactEntrySource).toContain('import "./index.js";');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});
