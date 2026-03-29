import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createSetVolumeLauncher } from "../src/set-volume-launcher";

class FakeProcess extends EventEmitter {}

describe("slice 14 - set volume launcher", () => {
  it("launches set_volume through powershell on win32 with volumePercent in child env", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.emit("close", 0);
        });
        return process;
      }
    );

    const launchSetVolume = createSetVolumeLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchSetVolume({
        volumePercent: 50
      })
    ).resolves.toBeUndefined();

    const firstCall = spawnProcess.mock.calls[0];
    expect(firstCall?.[0]).toBe("powershell");
    expect(firstCall?.[1]).toEqual([
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-Command",
      expect.any(String)
    ]);

    const script = firstCall?.[1]?.[5];
    expect(script).toContain("IAudioEndpointVolume");
    expect(script).toContain("SetMasterVolumeLevelScalar");

    expect(firstCall?.[2]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          LUNA_SET_VOLUME_PERCENT: "50"
        })
      })
    );
  });

  it("rejects on non-Windows platforms", async () => {
    const spawnProcess = vi.fn();
    const launchSetVolume = createSetVolumeLauncher({
      platform: "linux",
      spawnProcess
    });

    await expect(
      launchSetVolume({
        volumePercent: 50
      })
    ).rejects.toThrowError(
      "set_volume real launcher is currently supported only on Windows."
    );
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("rejects when powershell spawn fails", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.emit("error", new Error("spawn error"));
        });
        return process;
      }
    );

    const launchSetVolume = createSetVolumeLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchSetVolume({
        volumePercent: 50
      })
    ).rejects.toThrowError("Set volume launcher spawn failed: spawn error");
  });

  it("rejects when powershell exits with non-zero code", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.emit("close", 1);
        });
        return process;
      }
    );

    const launchSetVolume = createSetVolumeLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchSetVolume({
        volumePercent: 50
      })
    ).rejects.toThrowError("Set volume launcher exited with code 1.");
  });
});
