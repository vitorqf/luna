import { constants as fsConstants } from "node:fs";
import { access, cp, mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const SERVER_ARTIFACT_ENTRIES = [
  "apps/server",
  "packages/shared-types",
  "packages/protocol",
  "packages/command-parser",
] as const;

const AGENT_ARTIFACT_ENTRIES = [
  "apps/agent",
  "packages/shared-types",
  "packages/protocol",
] as const;

const ARTIFACT_ENTRIES = {
  server: SERVER_ARTIFACT_ENTRIES,
  agent: AGENT_ARTIFACT_ENTRIES,
} as const;

export type BuildArtifactTarget = keyof typeof ARTIFACT_ENTRIES;

export interface BuildArtifactOptions {
  projectRoot?: string;
  distDirName?: string;
  artifactsDirName?: string;
}

const assertPathExists = async (
  filePath: string,
  label: string,
): Promise<void> => {
  try {
    await access(filePath, fsConstants.F_OK);
  } catch {
    throw new Error(`${label} not found: ${filePath}`);
  }
};

export const createBuildArtifact = async (
  target: BuildArtifactTarget,
  options: BuildArtifactOptions = {},
): Promise<string> => {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const distDirName = options.distDirName ?? "dist";
  const artifactsDirName = options.artifactsDirName ?? "dist-artifacts";
  const sourceDistRoot = join(projectRoot, distDirName);
  const artifactRoot = join(projectRoot, artifactsDirName, target);
  const entries = ARTIFACT_ENTRIES[target];

  await assertPathExists(sourceDistRoot, "Compiled dist directory");

  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDistRoot, entry);
    const targetPath = join(artifactRoot, distDirName, entry);

    await assertPathExists(sourcePath, "Artifact source entry");
    await mkdir(dirname(targetPath), { recursive: true });
    await cp(sourcePath, targetPath, { recursive: true });
  }

  return artifactRoot;
};
