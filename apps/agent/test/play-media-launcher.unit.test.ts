import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  createPlayMediaLauncher,
  resolvePlayMediaTarget
} from "../src/play-media-launcher";

class FakeReadableStream extends EventEmitter {}
class FakeProcess extends EventEmitter {
  pid?: number;
  stdout: FakeReadableStream;
  stderr: FakeReadableStream;

  constructor(pid?: number) {
    super();
    this.pid = pid;
    this.stdout = new FakeReadableStream();
    this.stderr = new FakeReadableStream();
  }
}

describe("slice 15 - play media launcher", () => {
  it("launches direct http/https URLs via powershell start-process", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env?: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess(1234);
        queueMicrotask(() => {
          process.stdout.emit("data", "1234\n");
          process.emit("close", 0);
        });
        return process;
      }
    );

    const launchPlayMedia = createPlayMediaLauncher({
      platform: "win32",
      spawnProcess,
      resolveBrowserExecutable: () => "msedge",
      resolveFirstYouTubeVideoUrl: async () => "https://www.youtube.com/watch?v=fallback"
    });

    await expect(
      launchPlayMedia({
        mediaQuery: "https://example.com/audio.mp3"
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
    expect(firstCall?.[2]).toEqual(
      expect.objectContaining({
        env: expect.objectContaining({
          LUNA_PLAY_MEDIA_TARGET: "https://example.com/audio.mp3"
        })
      })
    );
  });

  it("resolves non-URL text to direct YouTube video URL", async () => {
    await expect(
      resolvePlayMediaTarget(
        "lo fi mix",
        async () => "https://www.youtube.com/watch?v=abc12345678"
      )
    ).resolves.toBe("https://www.youtube.com/watch?v=abc12345678");
  });

  it("kills the previous play_media process before launching the next one", async () => {
    let launchCount = 0;
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env?: NodeJS.ProcessEnv }) => {
        launchCount += 1;
        const pid = launchCount === 1 ? 111 : 222;
        const process = new FakeProcess(pid);
        queueMicrotask(() => {
          process.stdout.emit("data", `${pid}\n`);
          process.emit("close", 0);
        });
        return process;
      }
    );
    const killProcessTree = vi.fn(async (_pid: number) => undefined);

    const launchPlayMedia = createPlayMediaLauncher({
      platform: "win32",
      spawnProcess,
      killProcessTree,
      resolveBrowserExecutable: () => "msedge",
      resolveFirstYouTubeVideoUrl: async () => "https://www.youtube.com/watch?v=abc12345678"
    });

    await launchPlayMedia({ mediaQuery: "lo fi mix" });
    await launchPlayMedia({ mediaQuery: "ambient mix" });

    expect(killProcessTree).toHaveBeenCalledTimes(1);
    expect(killProcessTree).toHaveBeenCalledWith(111);
  });

  it("rejects on non-Windows platforms", async () => {
    const spawnProcess = vi.fn();
    const launchPlayMedia = createPlayMediaLauncher({
      platform: "linux",
      spawnProcess
    });

    await expect(
      launchPlayMedia({
        mediaQuery: "lo-fi"
      })
    ).rejects.toThrowError(
      "play_media real launcher is currently supported only on Windows."
    );
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("rejects when powershell spawn fails", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env?: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.emit("error", new Error("spawn error"));
        });
        return process;
      }
    );

    const launchPlayMedia = createPlayMediaLauncher({
      platform: "win32",
      spawnProcess,
      resolveBrowserExecutable: () => "msedge",
      resolveFirstYouTubeVideoUrl: async () => "https://www.youtube.com/watch?v=abc12345678"
    });

    await expect(
      launchPlayMedia({
        mediaQuery: "lo-fi"
      })
    ).rejects.toThrowError("Play media launcher spawn failed: spawn error");
  });

  it("rejects when powershell exits with non-zero code", async () => {
    const spawnProcess = vi.fn(
      (_command: string, _args: string[], _options: { env?: NodeJS.ProcessEnv }) => {
        const process = new FakeProcess();
        queueMicrotask(() => {
          process.stderr.emit("data", "powershell failed");
          process.emit("close", 1);
        });
        return process;
      }
    );

    const launchPlayMedia = createPlayMediaLauncher({
      platform: "win32",
      spawnProcess,
      resolveBrowserExecutable: () => "msedge",
      resolveFirstYouTubeVideoUrl: async () => "https://www.youtube.com/watch?v=abc12345678"
    });

    await expect(
      launchPlayMedia({
        mediaQuery: "lo-fi"
      })
    ).rejects.toThrowError(
      "Play media launcher exited with code 1: powershell failed"
    );
  });
});
