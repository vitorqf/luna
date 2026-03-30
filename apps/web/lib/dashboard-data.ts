import type { Command as ServerCommand, Device as ServerDevice } from "@luna/shared-types";
import type { CommandResult, Device, SystemStats } from "./types";

const reasonMessageByCode: Record<string, string> = {
  invalid_params: "Parâmetros inválidos para executar o comando.",
  unsupported_intent: "Esse dispositivo não suporta este comando.",
  execution_error: "Falha ao executar no dispositivo."
};

const mapFailureReasonToMessage = (
  reason: string | undefined
): string => {
  if (!reason) {
    return "Falha na execução.";
  }

  return reasonMessageByCode[reason] ?? reason;
};

const inferDeviceType = (device: ServerDevice): Device["type"] => {
  const source = `${device.name} ${device.hostname}`.toLocaleLowerCase();

  if (source.includes("notebook") || source.includes("laptop")) {
    return "notebook";
  }

  if (source.includes("mini")) {
    return "mini_pc";
  }

  if (source.includes("server")) {
    return "server";
  }

  return "desktop";
};

export const mapDevicesToUi = (devices: ServerDevice[]): Device[] =>
  devices.map((device) => ({
    id: device.id,
    name: device.name,
    hostname: device.hostname,
    type: inferDeviceType(device),
    status: device.status,
    capabilities: [...device.capabilities],
    lastSeen: device.status === "online" ? "now" : "offline"
  }));

export const mapCommandsToUi = (
  commands: ServerCommand[],
  devices: ReadonlyArray<Pick<Device, "id" | "name">>
): CommandResult[] => {
  const deviceNameById = new Map(devices.map((device) => [device.id, device.name]));

  return [...commands]
    .reverse()
    .map((command): CommandResult => ({
      id: command.id,
      command: command.rawText,
      targetDevice: deviceNameById.get(command.targetDeviceId) ?? "Unknown device",
      targetDeviceId: command.targetDeviceId,
      status: command.status === "success" ? "success" : "error",
      message:
        command.status === "success"
          ? "Executed successfully"
          : mapFailureReasonToMessage(command.reason),
      timestamp: "recent"
    }));
};

export const buildStats = (
  devices: ReadonlyArray<Pick<Device, "status">>,
  commands: ReadonlyArray<Pick<CommandResult, "status">>
): SystemStats => ({
  totalDevices: devices.length,
  devicesOnline: devices.filter((device) => device.status === "online").length,
  commandsExecuted: commands.length,
  recentFailures: commands.filter((command) => command.status === "error").length
});
