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

  it("creates agent artifact without server files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-agent-"));

    try {
      await seedDistFixtures(projectRoot);

      const artifactRoot = await createBuildArtifact("agent", { projectRoot });

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
