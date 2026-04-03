import { constants as fsConstants } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  cp,
  mkdir,
  readdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { get as httpsGet } from "node:https";
import { spawn } from "node:child_process";

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
  runtimeExecutablePath?: string;
  targetPlatform?: NodeJS.Platform;
  targetArchitecture?: NodeJS.Architecture;
  runtimeNodeVersion?: string;
  resolveAgentRuntimeExecutablePath?: ((input: {
    projectRoot: string;
    targetPlatform: NodeJS.Platform;
    targetArchitecture: NodeJS.Architecture;
    runtimeNodeVersion: string;
  }) => Promise<string>) | undefined;
}

const EMBEDDED_WEB_ARTIFACT_DIR_NAME = "web";
const WORKSPACE_NODE_MODULES_SCOPE = "@luna";
const AGENT_RUNTIME_DIR_NAME = "runtime";
const AGENT_RUNTIME_DEPENDENCIES = ["dotenv", "ws"] as const;
const AGENT_WINDOWS_LAUNCHER_NAME = "run-agent.cmd";
const AGENT_POSIX_LAUNCHER_NAME = "run-agent.sh";
const PORTABLE_RUNTIME_CACHE_DIR_NAME = ".portable-runtime-cache";
const AGENT_ENV_EXAMPLE_SOURCE = `# Luna Agent
LUNA_AGENT_SERVER_URL=ws://127.0.0.1:4000
LUNA_AGENT_DEVICE_ID=
LUNA_AGENT_DEVICE_NAME=
LUNA_AGENT_DEVICE_HOSTNAME=
`;

const mapLinuxRuntimeArchitecture = (
  architecture: NodeJS.Architecture,
): "x64" | "arm64" => {
  if (architecture === "x64" || architecture === "arm64") {
    return architecture;
  }

  throw new Error(
    `Unsupported Linux architecture for portable runtime: ${architecture}`,
  );
};

export const createPortableLinuxRuntimeArchiveUrl = (input: {
  nodeVersion: string;
  architecture: NodeJS.Architecture;
}): string => {
  const mappedArchitecture = mapLinuxRuntimeArchitecture(input.architecture);
  const normalizedVersion = input.nodeVersion.trim();
  if (!/^\d+\.\d+\.\d+$/.test(normalizedVersion)) {
    throw new Error(
      `Invalid Node version for portable runtime: ${input.nodeVersion}`,
    );
  }

  return `https://nodejs.org/dist/v${normalizedVersion}/node-v${normalizedVersion}-linux-${mappedArchitecture}.tar.xz`;
};

const runCommand = async (
  command: string,
  args: string[],
): Promise<void> =>
  new Promise<void>((resolveCommand, rejectCommand) => {
    const child = spawn(command, args, {
      stdio: "ignore",
    });

    child.once("error", (error) => rejectCommand(error));
    child.once("close", (code) => {
      if (code !== 0) {
        rejectCommand(
          new Error(
            `Command failed with code ${code}: ${command} ${args.join(" ")}`,
          ),
        );
        return;
      }

      resolveCommand();
    });
  });

const downloadFile = async (
  url: string,
  destinationPath: string,
): Promise<void> =>
  new Promise<void>((resolveDownload, rejectDownload) => {
    const request = httpsGet(url, (response) => {
      if (response.statusCode !== 200) {
        rejectDownload(
          new Error(
            `Failed to download portable runtime (${response.statusCode}) from ${url}`,
          ),
        );
        response.resume();
        return;
      }

      if (!response.headers["content-length"]) {
        // no-op: content length is optional, but response must still be consumed.
      }

      const chunks: Buffer[] = [];
      response.on("data", (chunk: Buffer | string) => {
        chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
      });
      response.once("error", (error) => rejectDownload(error));
      response.once("end", () => {
        void writeFile(destinationPath, Buffer.concat(chunks))
          .then(() => resolveDownload())
          .catch((error) => rejectDownload(error));
      });
    });

    request.once("error", (error) => rejectDownload(error));
  });

const resolvePortableLinuxRuntimeExecutablePath = async (input: {
  projectRoot: string;
  runtimeNodeVersion: string;
  targetArchitecture: NodeJS.Architecture;
}): Promise<string> => {
  const runtimeArchiveUrl = createPortableLinuxRuntimeArchiveUrl({
    nodeVersion: input.runtimeNodeVersion,
    architecture: input.targetArchitecture,
  });
  const mappedArchitecture = mapLinuxRuntimeArchitecture(input.targetArchitecture);
  const normalizedVersion = input.runtimeNodeVersion.trim();
  const archiveFileName = `node-v${normalizedVersion}-linux-${mappedArchitecture}.tar.xz`;
  const extractedDirName = `node-v${normalizedVersion}-linux-${mappedArchitecture}`;
  const runtimeCacheRoot = join(
    input.projectRoot,
    PORTABLE_RUNTIME_CACHE_DIR_NAME,
    extractedDirName,
  );
  const runtimeExecutablePath = join(runtimeCacheRoot, "bin", "node");

  try {
    await assertPathExists(runtimeExecutablePath, "Portable runtime executable");
    return runtimeExecutablePath;
  } catch {
    // cache miss: continue and download/extract.
  }

  const downloadCacheRoot = join(input.projectRoot, PORTABLE_RUNTIME_CACHE_DIR_NAME);
  const archivePath = join(downloadCacheRoot, archiveFileName);
  const extractTempDir = join(downloadCacheRoot, `extract-${randomUUID()}`);

  await mkdir(downloadCacheRoot, { recursive: true });

  try {
    await assertPathExists(archivePath, "Portable runtime archive");
  } catch {
    await downloadFile(runtimeArchiveUrl, archivePath);
  }

  await rm(runtimeCacheRoot, { recursive: true, force: true });
  await rm(extractTempDir, { recursive: true, force: true });
  await mkdir(extractTempDir, { recursive: true });

  try {
    await runCommand("tar", ["-xJf", archivePath, "-C", extractTempDir]);
  } catch (error) {
    const baseMessage =
      error instanceof Error ? error.message : "Unknown tar extraction error.";
    throw new Error(
      `${baseMessage}. Ensure 'tar' with xz support is installed on the build machine.`,
    );
  }

  const extractedRuntimeRoot = join(extractTempDir, extractedDirName);
  await assertPathExists(extractedRuntimeRoot, "Extracted portable runtime root");
  await cp(extractedRuntimeRoot, runtimeCacheRoot, { recursive: true });
  await rm(extractTempDir, { recursive: true, force: true });

  await assertPathExists(runtimeExecutablePath, "Portable runtime executable");
  return runtimeExecutablePath;
};

const resolveAgentRuntimeExecutablePath = async (input: {
  projectRoot: string;
  targetPlatform: NodeJS.Platform;
  targetArchitecture: NodeJS.Architecture;
  runtimeNodeVersion: string;
  runtimeExecutablePath: string | undefined;
  resolveAgentRuntimeExecutablePath: BuildArtifactOptions["resolveAgentRuntimeExecutablePath"];
}): Promise<string> => {
  if (input.runtimeExecutablePath) {
    return resolve(input.projectRoot, input.runtimeExecutablePath);
  }

  if (input.resolveAgentRuntimeExecutablePath) {
    return input.resolveAgentRuntimeExecutablePath({
      projectRoot: input.projectRoot,
      targetPlatform: input.targetPlatform,
      targetArchitecture: input.targetArchitecture,
      runtimeNodeVersion: input.runtimeNodeVersion,
    });
  }

  if (input.targetPlatform === "linux") {
    return resolvePortableLinuxRuntimeExecutablePath({
      projectRoot: input.projectRoot,
      runtimeNodeVersion: input.runtimeNodeVersion,
      targetArchitecture: input.targetArchitecture,
    });
  }

  return process.execPath;
};

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

const getAgentRuntimeFileName = (platform: NodeJS.Platform): string =>
  platform === "win32" ? "node.exe" : "node";

const createAgentLauncherSource = (platform: NodeJS.Platform): string =>
  platform === "win32"
    ? [
        "@echo off",
        "setlocal",
        'cd /d "%~dp0"',
        'if not exist ".env" (',
        '  copy /Y ".env.example" ".env" >nul',
        '  echo [luna][agent] created .env from template. Starting with defaults and CLI overrides.',
        ")",
        '"%~dp0runtime\\node.exe" "%~dp0dist\\apps\\agent\\src\\main.js" %*',
        "exit /b %errorlevel%",
        "",
      ].join("\n")
    : [
        "#!/bin/sh",
        "set -eu",
        'SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)',
        'cd "$SCRIPT_DIR"',
        'if [ ! -f ".env" ]; then',
        '  cp ".env.example" ".env"',
        '  echo "[luna][agent] created .env from template. Starting with defaults and CLI overrides."',
        "fi",
        'exec "./runtime/node" "./dist/apps/agent/src/main.js" "$@"',
        "",
      ].join("\n");

export const createBuildArtifact = async (
  target: BuildArtifactTarget,
  options: BuildArtifactOptions = {},
): Promise<string> => {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const distDirName = options.distDirName ?? "dist";
  const artifactsDirName = options.artifactsDirName ?? "dist-artifacts";
  const embeddedWebDirPath =
    options.embeddedWebDirPath ?? join("apps", "web", "out");
  const targetPlatform = options.targetPlatform ?? process.platform;
  const targetArchitecture = options.targetArchitecture ?? process.arch;
  const runtimeNodeVersion = options.runtimeNodeVersion ?? process.versions.node;
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

  if (target === "agent") {
    const runtimeExecutablePath = await resolveAgentRuntimeExecutablePath({
      projectRoot,
      targetPlatform,
      targetArchitecture,
      runtimeNodeVersion,
      runtimeExecutablePath: options.runtimeExecutablePath,
      resolveAgentRuntimeExecutablePath: options.resolveAgentRuntimeExecutablePath,
    });
    const runtimeTargetPath = join(
      artifactRoot,
      AGENT_RUNTIME_DIR_NAME,
      getAgentRuntimeFileName(targetPlatform),
    );
    await assertPathExists(runtimeExecutablePath, "Agent runtime executable");
    await mkdir(dirname(runtimeTargetPath), { recursive: true });
    await copyFile(runtimeExecutablePath, runtimeTargetPath);
    if (targetPlatform !== "win32") {
      await chmod(runtimeTargetPath, 0o755);
    }

    for (const dependencyName of AGENT_RUNTIME_DEPENDENCIES) {
      const dependencySourcePath = join(projectRoot, "node_modules", dependencyName);
      const dependencyTargetPath = join(artifactRoot, "node_modules", dependencyName);

      await assertPathExists(
        dependencySourcePath,
        `Agent runtime dependency ${dependencyName}`,
      );
      await cp(dependencySourcePath, dependencyTargetPath, { recursive: true });
    }

    await writeFile(
      join(artifactRoot, ".env.example"),
      AGENT_ENV_EXAMPLE_SOURCE,
      "utf-8",
    );

    const launcherFileName =
      targetPlatform === "win32"
        ? AGENT_WINDOWS_LAUNCHER_NAME
        : AGENT_POSIX_LAUNCHER_NAME;
    const launcherTargetPath = join(artifactRoot, launcherFileName);
    await writeFile(
      launcherTargetPath,
      createAgentLauncherSource(targetPlatform),
      "utf-8",
    );
    if (targetPlatform !== "win32") {
      await chmod(launcherTargetPath, 0o755);
    }
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
    await cp(join(artifactRoot, distDirName, entry), packageArtifactRoot, {
      recursive: true,
    });
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
