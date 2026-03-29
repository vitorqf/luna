import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { createNotifyLauncher } from "../src/notify-launcher";

class FakeProcess extends EventEmitter {}

describe("slice 13 - notify launcher", () => {
  it("launches notify through powershell on win32 with title/message in child env", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.emit("close", 0);
        });
        return process;
      }
    );

    const launchNotify = createNotifyLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchNotify({
        title: "Luna",
        message: "Backup concluido"
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
    expect(script).toContain("CreateToastNotifier(");
    expect(script).toContain(
      "{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe"
    );
    expect(script).toContain("session 0");
    expect(firstCall?.[2]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          LUNA_NOTIFY_TITLE: "Luna",
          LUNA_NOTIFY_MESSAGE: "Backup concluido"
        })
      })
    );
  });

  it("rejects on non-Windows platforms", async () => {
    const spawnProcess = vi.fn();
    const launchNotify = createNotifyLauncher({
      platform: "linux",
      spawnProcess
    });

    await expect(
      launchNotify({
        title: "Luna",
        message: "Backup concluido"
      })
    ).rejects.toThrowError(
      "notify real launcher is currently supported only on Windows."
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

    const launchNotify = createNotifyLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchNotify({
        title: "Luna",
        message: "Backup concluido"
      })
    ).rejects.toThrowError("Notify launcher spawn failed: spawn error");
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

    const launchNotify = createNotifyLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchNotify({
        title: "Luna",
        message: "Backup concluido"
      })
    ).rejects.toThrowError("Notify launcher exited with code 1.");
  });
});
