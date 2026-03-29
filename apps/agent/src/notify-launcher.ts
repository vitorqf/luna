import { spawn } from "node:child_process";

export interface NotifyInput {
  title: string;
  message: string;
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
  args: string[],
  options: {
    env: NodeJS.ProcessEnv;
  }
) => SpawnedProcess;

export interface NotifyLauncherOptions {
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
}

const WINDOWS_PLATFORM = "win32";
const NOTIFY_TITLE_ENV = "LUNA_NOTIFY_TITLE";
const NOTIFY_MESSAGE_ENV = "LUNA_NOTIFY_MESSAGE";
const POWERSHELL_APP_ID =
  "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe";

const createDefaultSpawnProcess = (): SpawnProcess => (command, args, options) =>
  spawn(command, args, {
    windowsHide: true,
    stdio: "ignore",
    env: options.env
  });

const NOTIFY_POWERSHELL_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  `$title = $env:${NOTIFY_TITLE_ENV}`,
  `$message = $env:${NOTIFY_MESSAGE_ENV}`,
  "if ([string]::IsNullOrWhiteSpace($title) -or [string]::IsNullOrWhiteSpace($message)) {",
  "  throw 'Notify launcher requires non-empty title and message.'",
  "}",
  "$sessionId = (Get-Process -Id $PID).SessionId",
  "if ($sessionId -eq 0) {",
  "  throw 'Notify launcher cannot show Windows toast in session 0 (service/non-interactive session).'",
  "}",
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] > $null",
  "[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] > $null",
  "$escapedTitle = [System.Security.SecurityElement]::Escape($title)",
  "$escapedMessage = [System.Security.SecurityElement]::Escape($message)",
  "$xmlTemplate = \"<toast><visual><binding template='ToastGeneric'><text>$escapedTitle</text><text>$escapedMessage</text></binding></visual></toast>\"",
  "$xml = New-Object Windows.Data.Xml.Dom.XmlDocument",
  "$xml.LoadXml($xmlTemplate)",
  "$toast = [Windows.UI.Notifications.ToastNotification]::new($xml)",
  `$appId = '${POWERSHELL_APP_ID}'`,
  "$fallbackPowerShellApp = Get-StartApps | Where-Object { $_.Name -like '*PowerShell*' } | Select-Object -First 1",
  "if ($fallbackPowerShellApp -and -not [string]::IsNullOrWhiteSpace($fallbackPowerShellApp.AppID)) {",
  "  $appId = $fallbackPowerShellApp.AppID",
  "}",
  "$notifier = [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId)",
  "$notifier.Show($toast)"
].join("; ");

const createNotifyCommandArgs = (): string[] => [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  NOTIFY_POWERSHELL_SCRIPT
];

const buildNotifyEnv = (input: NotifyInput): NodeJS.ProcessEnv => ({
  ...process.env,
  [NOTIFY_TITLE_ENV]: input.title,
  [NOTIFY_MESSAGE_ENV]: input.message
});

const launchWindowsNotify = async (
  input: NotifyInput,
  spawnProcess: SpawnProcess
): Promise<void> => {
  const notifyProcess = spawnProcess(
    "powershell",
    createNotifyCommandArgs(),
    {
      env: buildNotifyEnv(input)
    }
  );

  await new Promise<void>((resolve, reject) => {
    notifyProcess.once("error", (error) => {
      reject(new Error(`Notify launcher spawn failed: ${error.message}`));
    });

    notifyProcess.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Notify launcher exited with code ${String(code)}.`));
    });
  });
};

export const createNotifyLauncher = (
  options: NotifyLauncherOptions = {}
): ((input: NotifyInput) => Promise<void>) => {
  const platform = options.platform ?? process.platform;
  const spawnProcess = options.spawnProcess ?? createDefaultSpawnProcess();

  return async (input: NotifyInput): Promise<void> => {
    if (platform !== WINDOWS_PLATFORM) {
      throw new Error("notify real launcher is currently supported only on Windows.");
    }

    await launchWindowsNotify(input, spawnProcess);
  };
};
