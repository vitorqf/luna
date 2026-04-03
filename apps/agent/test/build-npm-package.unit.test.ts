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
import { buildAgentNpmPackage } from "../src/build-npm-package";

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

describe("slice 49 - agent npm cli package", () => {
  it("creates a npm cli package directory with custom package metadata", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-agent-npm-package-"));
    const bundledSource = "#!/usr/bin/env node\nconsole.log('agent');\n";

    try {
      await writeFixtureFile(
        join(projectRoot, "apps/agent/src/main.ts"),
        "console.log('source')\n",
      );

      const outputRoot = await buildAgentNpmPackage({
        projectRoot,
        packageName: "@acme/agent-cli",
        packageVersion: "1.2.3",
        cliCommandName: "acme-agent",
        bundleCliEntry: async ({ outputFilePath }) => {
          await writeFixtureFile(outputFilePath, bundledSource);
        },
      });

      expect(outputRoot).toBe(join(projectRoot, "dist-packages/agent-cli"));
      await expect(
        pathExists(join(outputRoot, "bin/acme-agent.js")),
      ).resolves.toBe(true);

      await expect(
        readFile(join(outputRoot, "bin/acme-agent.js"), "utf-8"),
      ).resolves.toBe(bundledSource);

      const packageJsonSource = await readFile(
        join(outputRoot, "package.json"),
        "utf-8",
      );
      expect(JSON.parse(packageJsonSource)).toEqual({
        name: "@acme/agent-cli",
        version: "1.2.3",
        type: "commonjs",
        private: false,
        bin: {
          "acme-agent": "bin/acme-agent.js",
        },
        files: ["bin"],
        engines: {
          node: ">=20",
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it("uses default package metadata when custom values are not provided", async () => {
    const projectRoot = await mkdtemp(join(tmpdir(), "luna-agent-npm-package-defaults-"));

    try {
      await writeFixtureFile(
        join(projectRoot, "apps/agent/src/main.ts"),
        "console.log('source')\n",
      );

      const outputRoot = await buildAgentNpmPackage({
        projectRoot,
        bundleCliEntry: async ({ outputFilePath }) => {
          await writeFixtureFile(outputFilePath, "#!/usr/bin/env node\n");
        },
      });

      const packageJsonSource = await readFile(
        join(outputRoot, "package.json"),
        "utf-8",
      );
      expect(JSON.parse(packageJsonSource)).toEqual({
        name: "@vitorqf/luna-agent",
        version: "0.0.0",
        type: "commonjs",
        private: false,
        bin: {
          "luna-agent": "bin/luna-agent.js",
        },
        files: ["bin"],
        engines: {
          node: ">=20",
        },
      });
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });
});

