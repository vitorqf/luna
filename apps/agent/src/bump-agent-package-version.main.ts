import { readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import {
  bumpVersionFromPackageJsonSource,
  readVersionFromPackageJsonSource,
} from "./agent-package-version";

const run = async (): Promise<void> => {
  const projectRoot = resolve(process.cwd());
  const packageJsonPath = join(projectRoot, "apps", "agent", "package.json");
  const packageJsonSource = await readFile(packageJsonPath, "utf-8");

  const currentVersion = readVersionFromPackageJsonSource(packageJsonSource);
  const nextPackageJsonSource = bumpVersionFromPackageJsonSource(packageJsonSource);
  const nextVersion = readVersionFromPackageJsonSource(nextPackageJsonSource);

  await writeFile(packageJsonPath, nextPackageJsonSource, "utf-8");
  console.info(
    `[luna][agent-version] bumped ${currentVersion} -> ${nextVersion} (${packageJsonPath})`,
  );
};

void run().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown version bump failure.";
  console.error(`[luna][agent-version] failed: ${message}`);
  process.exitCode = 1;
});
