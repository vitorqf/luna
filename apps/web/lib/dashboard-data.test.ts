import { describe, expect, it } from "vitest";
import type { Command, Device as ServerDevice } from "@luna/shared-types";
import { buildStats, mapCommandsToUi, mapDevicesToUi } from "./dashboard-data";

describe("dashboard data mapping", () => {
  it("maps server devices to ui devices with baseline capabilities", () => {
    const devices: ServerDevice[] = [
      {
        id: "server-principal",
        name: "Server Principal",
        hostname: "server-principal.local",
        status: "online"
      }
    ];

    expect(mapDevicesToUi(devices)).toEqual([
      {
        id: "server-principal",
        name: "Server Principal",
        type: "server",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"],
        lastSeen: "now"
      }
    ]);
  });

  it("maps server command history to ui command feed entries", () => {
    const commands: Command[] = [
      {
        id: "cmd-1",
        rawText: "Abrir Spotify no Notebook 2",
        intent: "open_app",
        targetDeviceId: "notebook-2",
        params: {
          appName: "Spotify"
        },
        status: "success"
      }
    ];

    const uiDevices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"],
        lastSeen: "now"
      }
    ] as const;

    expect(mapCommandsToUi(commands, uiDevices)).toEqual([
      {
        id: "cmd-1",
        command: "Abrir Spotify no Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "success",
        message: "Executed successfully",
        timestamp: "recent"
      }
    ]);
  });

  it("maps failed server commands with reason to error message", () => {
    const commands: Command[] = [
      {
        id: "cmd-2",
        rawText: "Abrir Spotify no Notebook 2",
        intent: "open_app",
        targetDeviceId: "notebook-2",
        params: {
          appName: "Spotify"
        },
        status: "failed",
        reason: "open_app launcher failed"
      }
    ];

    const uiDevices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"],
        lastSeen: "now"
      }
    ] as const;

    expect(mapCommandsToUi(commands, uiDevices)).toEqual([
      {
        id: "cmd-2",
        command: "Abrir Spotify no Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "error",
        message: "open_app launcher failed",
        timestamp: "recent"
      }
    ]);
  });

  it("builds summary stats from devices and commands", () => {
    const devices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"]
      },
      {
        id: "server-principal",
        name: "Server Principal",
        type: "server",
        status: "offline",
        capabilities: ["notify", "open_app", "set_volume", "play_media"]
      }
    ] as const;

    const commands = [
      {
        id: "cmd-1",
        command: "Abrir Spotify no Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "success",
        message: "Executed successfully",
        timestamp: "recent"
      },
      {
        id: "cmd-2",
        command: "Comando invalido",
        targetDevice: "Unknown",
        targetDeviceId: "unknown",
        status: "error",
        message: "Unable to parse command.",
        timestamp: "recent"
      }
    ] as const;

    expect(buildStats(devices, commands)).toEqual({
      totalDevices: 2,
      devicesOnline: 1,
      commandsExecuted: 2,
      recentFailures: 1
    });
  });
});
