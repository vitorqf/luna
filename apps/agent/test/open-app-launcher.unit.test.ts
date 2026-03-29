import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  createOpenAppLauncher,
  resolveOpenAppTarget
} from "../src/open-app-launcher";

class FakeProcess extends EventEmitter {}

describe("slice 12 - open app launcher", () => {
  it("resolves aliases and launches app target through cmd start", async () => {
    const spawnProcess = vi.fn((_command: string, _args: string[]) => {
      const process = new FakeProcess();
      queueMicrotask(() => {
        process.emit("close", 0);
      });
      return process;
    });

    const launchOpenApp = createOpenAppLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchOpenApp({
        appName: "  Visual   Studio    Code "
      })
    ).resolves.toBeUndefined();

    expect(spawnProcess).toHaveBeenCalledWith("cmd", [
      "/c",
      "start",
      "",
      "code"
    ]);
  });

  it("rejects unsupported app aliases", async () => {
    const spawnProcess = vi.fn();
    const launchOpenApp = createOpenAppLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchOpenApp({
        appName: "Notepad"
      })
    ).rejects.toThrowError('Unsupported open_app app alias "notepad".');
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("rejects when command exits with non-zero code", async () => {
    const spawnProcess = vi.fn((_command: string, _args: string[]) => {
      const process = new FakeProcess();
      queueMicrotask(() => {
        process.emit("close", 1);
      });
      return process;
    });

    const launchOpenApp = createOpenAppLauncher({
      platform: "win32",
      spawnProcess
    });

    await expect(
      launchOpenApp({
        appName: "spotify"
      })
    ).rejects.toThrowError("Open app launcher exited with code 1.");
  });

  it("resolves the v1 allowlist aliases to expected launch targets", () => {
    expect(resolveOpenAppTarget("spotify")).toBe("spotify:");
    expect(resolveOpenAppTarget("google chrome")).toBe("chrome");
    expect(resolveOpenAppTarget("vs code")).toBe("code");
  });
});
