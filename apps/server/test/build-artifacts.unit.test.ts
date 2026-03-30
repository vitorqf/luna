import { constants as fsConstants } from "node:fs";
import {
  access,
  mkdtemp,
  mkdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBuildArtifact } from "../src/build-artifacts";

const writeFixtureFile = async (filePath: string): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, "fixture", "utf-8");
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

describe("slice 25 - build artifacts", () => {
  it("creates server artifact without agent files", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-artifact-server-"));

    try {
      await seedDistFixtures(projectRoot);

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
});
