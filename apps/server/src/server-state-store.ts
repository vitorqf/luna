import type { Command, Device, DeviceCapability } from "@luna/shared-types";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname } from "node:path";
import { isRecord } from "./utils/value";

const PERSISTED_SERVER_STATE_VERSION = 1 as const;

const DEVICE_CAPABILITIES: readonly DeviceCapability[] = [
  "notify",
  "open_app",
  "set_volume",
  "play_media",
];

const COMMAND_FAILURE_REASONS = [
  "invalid_params",
  "unsupported_intent",
  "execution_error",
] as const;

export interface PersistedServerState {
  devices: Device[];
  customDeviceAliases: Record<string, string>;
  commandHistory: Command[];
}

interface PersistedServerStateSnapshot extends PersistedServerState {
  version: typeof PERSISTED_SERVER_STATE_VERSION;
}

const EMPTY_PERSISTED_SERVER_STATE: PersistedServerState = {
  devices: [],
  customDeviceAliases: {},
  commandHistory: [],
};

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  isRecord(value) && !Array.isArray(value);

const isDeviceCapability = (value: unknown): value is DeviceCapability =>
  typeof value === "string" &&
  DEVICE_CAPABILITIES.some((capability) => capability === value);

const isDevice = (value: unknown): value is Device => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.hostname === "string" &&
    (value.status === "online" || value.status === "offline") &&
    Array.isArray(value.capabilities) &&
    value.capabilities.every(isDeviceCapability)
  );
};

const isCommand = (value: unknown): value is Command => {
  if (!isObjectRecord(value)) {
    return false;
  }

  const hasCommonFields =
    typeof value.id === "string" &&
    typeof value.rawText === "string" &&
    typeof value.intent === "string" &&
    typeof value.targetDeviceId === "string" &&
    isObjectRecord(value.params);
  if (!hasCommonFields) {
    return false;
  }

  if (value.status === "success") {
    return true;
  }

  return (
    value.status === "failed" &&
    typeof value.reason === "string" &&
    COMMAND_FAILURE_REASONS.some((reason) => reason === value.reason)
  );
};

const isPersistedServerState = (
  value: unknown,
): value is PersistedServerStateSnapshot => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    value.version === PERSISTED_SERVER_STATE_VERSION &&
    Array.isArray(value.devices) &&
    value.devices.every(isDevice) &&
    isObjectRecord(value.customDeviceAliases) &&
    Object.values(value.customDeviceAliases).every(
      (alias) => typeof alias === "string",
    ) &&
    Array.isArray(value.commandHistory) &&
    value.commandHistory.every(isCommand)
  );
};

export const loadPersistedServerState = (
  stateFile: string,
): PersistedServerState => {
  if (!existsSync(stateFile)) {
    return {
      devices: [],
      customDeviceAliases: {},
      commandHistory: [],
    };
  }

  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(readFileSync(stateFile, "utf-8"));
  } catch {
    throw new Error("Server state file is not valid JSON.");
  }

  if (!isPersistedServerState(parsedValue)) {
    throw new Error("Server state file has an invalid schema.");
  }

  return {
    devices: parsedValue.devices.map((device) => ({
      ...device,
      capabilities: [...device.capabilities],
    })),
    customDeviceAliases: { ...parsedValue.customDeviceAliases },
    commandHistory: parsedValue.commandHistory.map((command) => ({
      ...command,
      params: { ...command.params },
    })),
  };
};

export const savePersistedServerState = (
  stateFile: string,
  state: PersistedServerState,
): void => {
  mkdirSync(dirname(stateFile), { recursive: true });

  const tempFile = `${stateFile}.tmp`;
  try {
    writeFileSync(
      tempFile,
      JSON.stringify(
        {
          version: PERSISTED_SERVER_STATE_VERSION,
          devices: state.devices,
          customDeviceAliases: state.customDeviceAliases,
          commandHistory: state.commandHistory,
        },
        null,
        2,
      ),
      "utf-8",
    );
    renameSync(tempFile, stateFile);
  } finally {
    if (existsSync(tempFile)) {
      rmSync(tempFile, { force: true });
    }
  }
};

export const createEmptyPersistedServerState = (): PersistedServerState => ({
  ...EMPTY_PERSISTED_SERVER_STATE,
  customDeviceAliases: {},
});
