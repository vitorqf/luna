import { spawn } from "node:child_process";

export interface OpenAppInput {
  appName: string;
}

interface SpawnedProcess {
  once: {
    (event: "error", listener: (error: Error) => void): SpawnedProcess;
    (
      event: "close",
      listener: (code: number | null, signal: NodeJS.Signals | null) => void
    ): SpawnedProcess;
  };
}

type SpawnProcess = (
  command: string,
  args: string[]
) => SpawnedProcess;

export interface OpenAppLauncherOptions {
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
}

const WINDOWS_PLATFORM = "win32";
const SPACE_PATTERN = /\s+/g;

const OPEN_APP_TARGET_BY_ALIAS: Record<string, string> = {
  spotify: "spotify:",
  chrome: "chrome",
  "google chrome": "chrome",
  vscode: "code",
  "vs code": "code",
  "visual studio code": "code",
  code: "code"
};

export const normalizeOpenAppName = (appName: string): string =>
  appName
    .trim()
    .toLocaleLowerCase()
    .replace(SPACE_PATTERN, " ");

export const resolveOpenAppTarget = (appName: string): string => {
  const normalizedAppName = normalizeOpenAppName(appName);
  const resolvedTarget = OPEN_APP_TARGET_BY_ALIAS[normalizedAppName];
  if (!resolvedTarget) {
    throw new Error(`Unsupported open_app app alias "${normalizedAppName}".`);
  }

  return resolvedTarget;
};

const createDefaultSpawnProcess = (): SpawnProcess => (command, args) =>
  spawn(command, args, {
    windowsHide: true,
    stdio: "ignore"
  });

const createOpenAppCommandArgs = (target: string): string[] => [
  "/c",
  "start",
  "",
  target
];

const launchWindowsTarget = async (
  target: string,
  spawnProcess: SpawnProcess
): Promise<void> => {
  const openAppProcess = spawnProcess("cmd", createOpenAppCommandArgs(target));

  await new Promise<void>((resolve, reject) => {
    openAppProcess.once("error", (error) => {
      reject(new Error(`Open app launcher spawn failed: ${error.message}`));
    });

    openAppProcess.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Open app launcher exited with code ${String(code)}.`));
    });
  });
};

export const createOpenAppLauncher = (
  options: OpenAppLauncherOptions = {}
): ((input: OpenAppInput) => Promise<void>) => {
  const platform = options.platform ?? process.platform;
  const spawnProcess = options.spawnProcess ?? createDefaultSpawnProcess();

  return async (input: OpenAppInput): Promise<void> => {
    if (platform !== WINDOWS_PLATFORM) {
      throw new Error("open_app real launcher is currently supported only on Windows.");
    }

    const target = resolveOpenAppTarget(input.appName);
    await launchWindowsTarget(target, spawnProcess);
  };
};
