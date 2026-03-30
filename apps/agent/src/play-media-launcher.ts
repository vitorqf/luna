import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface PlayMediaInput {
  mediaQuery: string;
}

interface SpawnedProcess {
  pid?: number | undefined;
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
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
  args: string[],
  options: {
    windowsHide: boolean;
    stdio: "ignore" | "pipe";
    env?: NodeJS.ProcessEnv;
  }
) => SpawnedProcess;

type ResolveFirstYouTubeVideoUrl = (mediaQuery: string) => Promise<string>;
type ResolveBrowserExecutable = () => string;
type KillProcessTree = (pid: number) => Promise<void>;

export interface PlayMediaLauncherOptions {
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
  resolveFirstYouTubeVideoUrl?: ResolveFirstYouTubeVideoUrl;
  resolveBrowserExecutable?: ResolveBrowserExecutable;
  killProcessTree?: KillProcessTree;
  browserProfileDir?: string;
}

const WINDOWS_PLATFORM = "win32";
const DEFAULT_BROWSER_PROFILE_DIR = join(tmpdir(), "luna-play-media-browser");
const PLAY_MEDIA_BROWSER_PATH_ENV = "LUNA_PLAY_MEDIA_BROWSER_PATH";
const PLAY_MEDIA_TARGET_ENV = "LUNA_PLAY_MEDIA_TARGET";
const PLAY_MEDIA_PROFILE_DIR_ENV = "LUNA_PLAY_MEDIA_PROFILE_DIR";
const BROWSER_FALLBACK_COMMAND = "msedge";

const PLAY_MEDIA_START_PROCESS_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  `$browserPath = $env:${PLAY_MEDIA_BROWSER_PATH_ENV}`,
  `$target = $env:${PLAY_MEDIA_TARGET_ENV}`,
  `$profileDir = $env:${PLAY_MEDIA_PROFILE_DIR_ENV}`,
  "if ([string]::IsNullOrWhiteSpace($browserPath)) { throw 'Browser path is required.' }",
  "if ([string]::IsNullOrWhiteSpace($target)) { throw 'Play media target is required.' }",
  "if ([string]::IsNullOrWhiteSpace($profileDir)) { throw 'Browser profile directory is required.' }",
  "$args = @('--new-window', \"--user-data-dir=$profileDir\", '--no-first-run', '--disable-session-crashed-bubble', $target)",
  "$process = Start-Process -FilePath $browserPath -ArgumentList $args -PassThru",
  "Write-Output $process.Id"
].join("\n");

const createDefaultSpawnProcess = (): SpawnProcess => (command, args, options) =>
  spawn(command, args, {
    windowsHide: options.windowsHide,
    stdio: options.stdio,
    env: options.env
  });

const captureProcessOutput = (
  process: SpawnedProcess
): { readStdout: () => string; readStderr: () => string } => {
  let stdout = "";
  let stderr = "";

  process.stdout?.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  process.stderr?.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return {
    readStdout: () => stdout.trim(),
    readStderr: () => stderr.trim()
  };
};

const buildProcessOutput = (stdout: string, stderr: string): string => {
  const joinedOutput = [stderr, stdout].filter((value) => value.length > 0).join(" | ");
  return joinedOutput;
};

const waitForProcessClose = async (
  process: SpawnedProcess,
  launcherName: string
): Promise<{ stdout: string; stderr: string }> => {
  const output = captureProcessOutput(process);

  return new Promise((resolve, reject) => {
    process.once("error", (error) => {
      reject(new Error(`${launcherName} spawn failed: ${error.message}`));
    });

    process.once("close", (code) => {
      const stdout = output.readStdout();
      const stderr = output.readStderr();

      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      const mergedOutput = buildProcessOutput(stdout, stderr);
      if (mergedOutput.length > 0) {
        reject(
          new Error(
            `${launcherName} exited with code ${String(code)}: ${mergedOutput}`
          )
        );
        return;
      }

      reject(new Error(`${launcherName} exited with code ${String(code)}.`));
    });
  });
};

const isHttpUrl = (value: string): boolean => {
  try {
    const parsedUrl = new URL(value);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
};

const isExistingFile = (path: string): boolean =>
  path.length > 0 && existsSync(path);

const resolveBrowserCandidates = (): string[] => {
  const programFiles = process.env.ProgramFiles ?? "";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "";
  const localAppData = process.env.LocalAppData ?? "";

  return [
    join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    join(localAppData, "Google", "Chrome", "Application", "chrome.exe")
  ];
};

const createDefaultResolveBrowserExecutable = (): ResolveBrowserExecutable => () => {
  const candidates = resolveBrowserCandidates();
  const existingCandidate = candidates.find(isExistingFile);
  return existingCandidate ?? BROWSER_FALLBACK_COMMAND;
};

const buildYouTubeSearchUrl = (mediaQuery: string): string =>
  `https://www.youtube.com/results?search_query=${encodeURIComponent(mediaQuery)}`;

const extractYouTubeVideoId = (html: string): string | null => {
  const firstVideoIdMatch = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
  if (!firstVideoIdMatch) {
    return null;
  }

  return firstVideoIdMatch[1] ?? null;
};

const createDefaultResolveFirstYouTubeVideoUrl = (): ResolveFirstYouTubeVideoUrl =>
  async (mediaQuery) => {
    const searchUrl = buildYouTubeSearchUrl(mediaQuery);
    const response = await fetch(searchUrl);
    const html = await response.text();
    const videoId = extractYouTubeVideoId(html);
    if (!videoId) {
      return searchUrl;
    }

    return `https://www.youtube.com/watch?v=${videoId}`;
  };

export const resolvePlayMediaTarget = async (
  mediaQuery: string,
  resolveFirstYouTubeVideoUrl: ResolveFirstYouTubeVideoUrl
): Promise<string> => {
  const trimmedMediaQuery = mediaQuery.trim();
  if (isHttpUrl(trimmedMediaQuery)) {
    return trimmedMediaQuery;
  }

  return resolveFirstYouTubeVideoUrl(trimmedMediaQuery);
};

const parseLaunchedProcessId = (stdout: string): number => {
  const processIdMatch = stdout.match(/(\d+)/);
  if (!processIdMatch) {
    throw new Error("Play media launcher did not return a process id.");
  }

  return Number.parseInt(processIdMatch[1] ?? "", 10);
};

const createDefaultKillProcessTree = (
  spawnProcess: SpawnProcess
): KillProcessTree => async (pid) => {
  const killProcess = spawnProcess(
    "taskkill",
    ["/PID", String(pid), "/T", "/F"],
    {
      windowsHide: true,
      stdio: "ignore"
    }
  );

  await new Promise<void>((resolve, reject) => {
    killProcess.once("error", (error) => {
      reject(new Error(`Play media kill process spawn failed: ${error.message}`));
    });

    killProcess.once("close", (code) => {
      if (code === 0 || code === 1 || code === 128) {
        resolve();
        return;
      }

      reject(
        new Error(`Play media kill process exited with code ${String(code)}.`)
      );
    });
  });
};

const createPlayMediaCommandArgs = (): string[] => [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  PLAY_MEDIA_START_PROCESS_SCRIPT
];

const buildPlayMediaEnv = (
  browserExecutable: string,
  target: string,
  profileDir: string
): NodeJS.ProcessEnv => ({
  ...process.env,
  [PLAY_MEDIA_BROWSER_PATH_ENV]: browserExecutable,
  [PLAY_MEDIA_TARGET_ENV]: target,
  [PLAY_MEDIA_PROFILE_DIR_ENV]: profileDir
});

export const createPlayMediaLauncher = (
  options: PlayMediaLauncherOptions = {}
): ((input: PlayMediaInput) => Promise<void>) => {
  const platform = options.platform ?? process.platform;
  const spawnProcess = options.spawnProcess ?? createDefaultSpawnProcess();
  const resolveFirstYouTubeVideoUrl =
    options.resolveFirstYouTubeVideoUrl ?? createDefaultResolveFirstYouTubeVideoUrl();
  const resolveBrowserExecutable =
    options.resolveBrowserExecutable ?? createDefaultResolveBrowserExecutable();
  const killProcessTree =
    options.killProcessTree ?? createDefaultKillProcessTree(spawnProcess);
  const browserProfileDir = options.browserProfileDir ?? DEFAULT_BROWSER_PROFILE_DIR;
  let activePlayMediaProcessId: number | null = null;

  return async (input: PlayMediaInput): Promise<void> => {
    if (platform !== WINDOWS_PLATFORM) {
      throw new Error("play_media real launcher is currently supported only on Windows.");
    }

    const target = await resolvePlayMediaTarget(
      input.mediaQuery,
      resolveFirstYouTubeVideoUrl
    );

    if (activePlayMediaProcessId !== null) {
      try {
        await killProcessTree(activePlayMediaProcessId);
      } finally {
        activePlayMediaProcessId = null;
      }
    }

    const browserExecutable = resolveBrowserExecutable();
    const launchProcess = spawnProcess(
      "powershell",
      createPlayMediaCommandArgs(),
      {
        windowsHide: true,
        stdio: "pipe",
        env: buildPlayMediaEnv(browserExecutable, target, browserProfileDir)
      }
    );

    const { stdout } = await waitForProcessClose(
      launchProcess,
      "Play media launcher"
    );
    activePlayMediaProcessId = parseLaunchedProcessId(stdout);
  };
};
