import { constants as fsConstants } from "node:fs";
import {
  access,
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";

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
  embeddedWebDirPath?: string;
}

const EMBEDDED_WEB_ARTIFACT_DIR_NAME = "web";
const WORKSPACE_NODE_MODULES_SCOPE = "@luna";

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

const appendJsExtensionToRelativeSpecifier = (specifier: string): string => {
  if (!specifier.startsWith(".") || /\.[a-z0-9]+$/i.test(specifier)) {
    return specifier;
  }

  return `${specifier}.js`;
};

const rewriteJavaScriptModuleSpecifiers = (source: string): string =>
  source
    .replace(
      /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendJsExtensionToRelativeSpecifier(specifier)}${suffix}`,
    )
    .replace(
      /(import\s+["'])(\.\.?\/[^"']+)(["'])/g,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendJsExtensionToRelativeSpecifier(specifier)}${suffix}`,
    )
    .replace(
      /(import\(\s*["'])(\.\.?\/[^"']+)(["']\s*\))/g,
      (_match, prefix: string, specifier: string, suffix: string) =>
        `${prefix}${appendJsExtensionToRelativeSpecifier(specifier)}${suffix}`,
    );

const rewriteArtifactJavaScriptForNodeRuntime = async (
  rootDir: string,
): Promise<void> => {
  const entries = await readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = join(rootDir, entry.name);

    if (entry.isDirectory()) {
      await rewriteArtifactJavaScriptForNodeRuntime(entryPath);
      continue;
    }

    if (!entry.isFile() || extname(entry.name) !== ".js") {
      continue;
    }

    const currentSource = await readFile(entryPath, "utf-8");
    const rewrittenSource = rewriteJavaScriptModuleSpecifiers(currentSource);
    if (rewrittenSource !== currentSource) {
      await writeFile(entryPath, rewrittenSource, "utf-8");
    }
  }
};

export const createBuildArtifact = async (
  target: BuildArtifactTarget,
  options: BuildArtifactOptions = {},
): Promise<string> => {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const distDirName = options.distDirName ?? "dist";
  const artifactsDirName = options.artifactsDirName ?? "dist-artifacts";
  const embeddedWebDirPath =
    options.embeddedWebDirPath ?? join("apps", "web", "out");
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

  await rewriteArtifactJavaScriptForNodeRuntime(join(artifactRoot, distDirName));

  if (target === "server") {
    const embeddedWebSourcePath = join(projectRoot, embeddedWebDirPath);

    await assertPathExists(embeddedWebSourcePath, "Embedded web build directory");
    await cp(embeddedWebSourcePath, join(artifactRoot, EMBEDDED_WEB_ARTIFACT_DIR_NAME), {
      recursive: true,
    });
  }

  for (const entry of entries) {
    if (!entry.startsWith("packages/")) {
      continue;
    }

    const workspacePackageName = entry.slice("packages/".length);
    const packageArtifactRoot = join(
      artifactRoot,
      "node_modules",
      WORKSPACE_NODE_MODULES_SCOPE,
      workspacePackageName,
    );

    await mkdir(dirname(packageArtifactRoot), { recursive: true });
    await cp(join(sourceDistRoot, entry), packageArtifactRoot, { recursive: true });
    await writeFile(
      join(packageArtifactRoot, "package.json"),
      `${JSON.stringify(
        {
          name: `@luna/${workspacePackageName}`,
          private: true,
          type: "module",
          exports: "./src/index.js",
          types: "./src/index.d.ts",
        },
        null,
        2,
      )}\n`,
      "utf-8",
    );
  }

  return artifactRoot;
};
