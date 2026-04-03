import { describe, expect, it } from "vitest";
import type { Command, Device as ServerDevice } from "@luna/shared-types";
import { buildStats, mapCommandsToUi, mapDevicesToUi } from "./dashboard-data";

const asMalformedCommand = (command: unknown): Command => command as Command;

describe("dashboard data mapping", () => {
  it("maps server devices to ui devices with payload capabilities", () => {
    const devices: ServerDevice[] = [
      {
        id: "server-principal",
        name: "Server Principal",
        hostname: "server-principal.local",
        status: "online",
        capabilities: ["notify", "set_volume"]
      }
    ];

    expect(mapDevicesToUi(devices)).toEqual([
      {
        id: "server-principal",
        name: "Server Principal",
        hostname: "server-principal.local",
        type: "server",
        status: "online",
        capabilities: ["notify", "set_volume"],
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
        hostname: "notebook-2.local",
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

  it("maps execution_error reason to friendly error message", () => {
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
        reason: "execution_error"
      }
    ];

    const uiDevices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
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
        message: "Falha ao executar no dispositivo.",
        timestamp: "recent"
      }
    ]);
  });

  it("maps invalid_params and unsupported_intent reasons to friendly messages", () => {
    const commands: Command[] = [
      {
        id: "cmd-3",
        rawText: "Notificar Notebook 2",
        intent: "notify",
        targetDeviceId: "notebook-2",
        params: {},
        status: "failed",
        reason: "invalid_params"
      },
      {
        id: "cmd-4",
        rawText: "Reiniciar Notebook 2",
        intent: "restart",
        targetDeviceId: "notebook-2",
        params: {},
        status: "failed",
        reason: "unsupported_intent"
      }
    ];

    const uiDevices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"],
        lastSeen: "now"
      }
    ] as const;

    expect(mapCommandsToUi(commands, uiDevices)).toEqual([
      {
        id: "cmd-4",
        command: "Reiniciar Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "error",
        message: "Esse dispositivo não suporta este comando.",
        timestamp: "recent"
      },
      {
        id: "cmd-3",
        command: "Notificar Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "error",
        message: "Parâmetros inválidos para executar o comando.",
        timestamp: "recent"
      }
    ]);
  });

  it("falls back to raw reason when unknown, or default when missing", () => {
    const commands: Command[] = [
      asMalformedCommand({
        id: "cmd-5",
        rawText: "Abrir Spotify no Notebook 2",
        intent: "open_app",
        targetDeviceId: "notebook-2",
        params: {
          appName: "Spotify"
        },
        status: "failed",
        reason: "custom_reason"
      }),
      asMalformedCommand({
        id: "cmd-6",
        rawText: "Abrir Spotify no Notebook 2",
        intent: "open_app",
        targetDeviceId: "notebook-2",
        params: {
          appName: "Spotify"
        },
        status: "failed"
      })
    ];

    const uiDevices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"],
        lastSeen: "now"
      }
    ] as const;

    expect(mapCommandsToUi(commands, uiDevices)).toEqual([
      {
        id: "cmd-6",
        command: "Abrir Spotify no Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "error",
        message: "Falha na execução.",
        timestamp: "recent"
      },
      {
        id: "cmd-5",
        command: "Abrir Spotify no Notebook 2",
        targetDevice: "Notebook 2",
        targetDeviceId: "notebook-2",
        status: "error",
        message: "custom_reason",
        timestamp: "recent"
      }
    ]);
  });

  it("builds summary stats from devices and commands", () => {
    const devices = [
      {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        type: "notebook",
        status: "online",
        capabilities: ["notify", "open_app", "set_volume", "play_media"]
      },
      {
        id: "server-principal",
        name: "Server Principal",
        hostname: "server-principal.local",
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
