import {
  isCommandFailureReason,
  isCommandStatus,
  isDeviceCapability,
  isDeviceStatus,
  type Command,
  type Device,
} from "@luna/shared-types";
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

const isDevice = (value: unknown): value is Device => {
  if (!isObjectRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.name === "string" &&
    typeof value.hostname === "string" &&
    isDeviceStatus(value.status) &&
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

  if (!isCommandStatus(value.status)) {
    return false;
  }

  if (value.status === "success") {
    return true;
  }

  return isCommandFailureReason(value.reason);
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
