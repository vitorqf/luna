import { spawn } from "node:child_process";

export interface SetVolumeInput {
  volumePercent: number;
}

interface SpawnedProcess {
  once: {
    (event: "error", listener: (error: Error) => void): SpawnedProcess;
    (
      event: "close",
      listener: (code: number | null, signal: NodeJS.Signals | null) => void
    ): SpawnedProcess;
  };
  stdout?: NodeJS.ReadableStream | null;
  stderr?: NodeJS.ReadableStream | null;
}

type SpawnProcess = (
  command: string,
  args: string[],
  options: {
    env: NodeJS.ProcessEnv;
  }
) => SpawnedProcess;

export interface SetVolumeLauncherOptions {
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
}

const WINDOWS_PLATFORM = "win32";
const SET_VOLUME_ENV = "LUNA_SET_VOLUME_PERCENT";

const createDefaultSpawnProcess = (): SpawnProcess => (command, args, options) =>
  spawn(command, args, {
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
    env: options.env
  });

const SET_VOLUME_POWERSHELL_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  `$volumePercent = $env:${SET_VOLUME_ENV}`,
  "if ([string]::IsNullOrWhiteSpace($volumePercent)) {",
  "  throw 'Set volume launcher requires volumePercent.'",
  "}",
  "if ($volumePercent -notmatch '^\\d{1,3}$') {",
  "  throw 'Set volume launcher requires integer volumePercent.'",
  "}",
  "$volumeValue = [int]$volumePercent",
  "if ($volumeValue -lt 0 -or $volumeValue -gt 100) {",
  "  throw 'Set volume launcher volumePercent must be between 0 and 100.'",
  "}",
  "Add-Type -TypeDefinition @'",
  "using System;",
  "using System.Runtime.InteropServices;",
  "[Guid(\"A95664D2-9614-4F35-A746-DE8DB63617E6\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "interface IMMDeviceEnumerator",
  "{",
  "    int NotImpl1();",
  "    int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);",
  "}",
  "[Guid(\"D666063F-1587-4E43-81F1-B948E807363F\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "interface IMMDevice",
  "{",
  "    int Activate(ref Guid iid, int dwClsCtx, IntPtr pActivationParams, out IAudioEndpointVolume ppInterface);",
  "}",
  "[Guid(\"5CDF2C82-841E-4546-9722-0CF74078229A\"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]",
  "interface IAudioEndpointVolume",
  "{",
  "    int RegisterControlChangeNotify(IntPtr pNotify);",
  "    int UnregisterControlChangeNotify(IntPtr pNotify);",
  "    int GetChannelCount(out uint pnChannelCount);",
  "    int SetMasterVolumeLevel(float fLevelDB, Guid pguidEventContext);",
  "    int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);",
  "    int GetMasterVolumeLevel(float fLevelDB);",
  "    int GetMasterVolumeLevelScalar(out float pfLevel);",
  "    int SetChannelVolumeLevel(uint nChannel, float fLevelDB, Guid pguidEventContext);",
  "    int SetChannelVolumeLevelScalar(uint nChannel, float fLevel, Guid pguidEventContext);",
  "    int GetChannelVolumeLevel(uint nChannel, out float pfLevelDB);",
  "    int GetChannelVolumeLevelScalar(uint nChannel, out float pfLevel);",
  "    int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);",
  "    int GetMute(out bool pbMute);",
  "    int GetVolumeStepInfo(out uint pnStep, out uint pnStepCount);",
  "    int VolumeStepUp(Guid pguidEventContext);",
  "    int VolumeStepDown(Guid pguidEventContext);",
  "    int QueryHardwareSupport(out uint pdwHardwareSupportMask);",
  "    int GetVolumeRange(out float pflVolumeMindB, out float pflVolumeMaxdB, out float pflVolumeIncrementdB);",
  "}",
  "[ComImport, Guid(\"BCDE0395-E52F-467C-8E3D-C4579291692E\")]",
  "class MMDeviceEnumeratorComObject",
  "{",
  "}",
  "public static class LunaSetVolumeController",
  "{",
  "    public static void SetMasterVolume(float level)",
  "    {",
  "        var enumerator = (IMMDeviceEnumerator)(new MMDeviceEnumeratorComObject());",
  "        IMMDevice device;",
  "        Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out device));",
  "        var iid = typeof(IAudioEndpointVolume).GUID;",
  "        IAudioEndpointVolume volume;",
  "        Marshal.ThrowExceptionForHR(device.Activate(ref iid, 23, IntPtr.Zero, out volume));",
  "        Marshal.ThrowExceptionForHR(volume.SetMasterVolumeLevelScalar(level, Guid.Empty));",
  "    }",
  "}",
  "'@",
  "$scalar = [Math]::Min(1.0, [Math]::Max(0.0, [double]$volumeValue / 100.0))",
  "[LunaSetVolumeController]::SetMasterVolume([float]$scalar)"
].join("\n");

const createSetVolumeCommandArgs = (): string[] => [
  "-NoProfile",
  "-NonInteractive",
  "-ExecutionPolicy",
  "Bypass",
  "-Command",
  SET_VOLUME_POWERSHELL_SCRIPT
];

const buildSetVolumeEnv = (input: SetVolumeInput): NodeJS.ProcessEnv => ({
  ...process.env,
  [SET_VOLUME_ENV]: String(input.volumePercent)
});

const launchWindowsSetVolume = async (
  input: SetVolumeInput,
  spawnProcess: SpawnProcess
): Promise<void> => {
  const setVolumeProcess = spawnProcess(
    "powershell",
    createSetVolumeCommandArgs(),
    {
      env: buildSetVolumeEnv(input)
    }
  );

  let processOutput = "";
  const captureOutputChunk = (chunk: string | Buffer): void => {
    if (processOutput.length >= 2_000) {
      return;
    }

    processOutput += chunk.toString();
  };

  setVolumeProcess.stdout?.on("data", captureOutputChunk);
  setVolumeProcess.stderr?.on("data", captureOutputChunk);

  await new Promise<void>((resolve, reject) => {
    setVolumeProcess.once("error", (error) => {
      reject(new Error(`Set volume launcher spawn failed: ${error.message}`));
    });

    setVolumeProcess.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      const trimmedOutput = processOutput.trim();
      if (trimmedOutput.length > 0) {
        reject(
          new Error(
            `Set volume launcher exited with code ${String(code)}: ${trimmedOutput}`
          )
        );
        return;
      }

      reject(new Error(`Set volume launcher exited with code ${String(code)}.`));
    });
  });
};

export const createSetVolumeLauncher = (
  options: SetVolumeLauncherOptions = {}
): ((input: SetVolumeInput) => Promise<void>) => {
  const platform = options.platform ?? process.platform;
  const spawnProcess = options.spawnProcess ?? createDefaultSpawnProcess();

  return async (input: SetVolumeInput): Promise<void> => {
    if (platform !== WINDOWS_PLATFORM) {
      throw new Error("set_volume real launcher is currently supported only on Windows.");
    }

    await launchWindowsSetVolume(input, spawnProcess);
  };
};
