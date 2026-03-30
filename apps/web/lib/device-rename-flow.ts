export interface DeviceRenameState {
  isEditing: boolean;
  draftName: string;
  errorMessage: string | null;
}

const normalizeWhitespace = (value: string): string =>
  value.trim().replace(/\s+/g, " ");

export const createEditingDeviceRenameState = (
  currentName: string
): DeviceRenameState => ({
  isEditing: true,
  draftName: normalizeWhitespace(currentName),
  errorMessage: null
});

export const cancelDeviceRename = (currentName: string): DeviceRenameState => ({
  isEditing: false,
  draftName: normalizeWhitespace(currentName),
  errorMessage: null
});

export interface ExecuteDeviceRenameFlowInput {
  deviceId: string;
  draftName: string;
  renameDevice: (deviceId: string, name: string) => Promise<void>;
  refreshDashboard: () => Promise<void>;
}

export const executeDeviceRenameFlow = async (
  input: ExecuteDeviceRenameFlowInput
): Promise<string> => {
  const normalizedName = normalizeWhitespace(input.draftName);
  if (!normalizedName) {
    throw new Error("Device name is required.");
  }

  await input.renameDevice(input.deviceId, normalizedName);
  await input.refreshDashboard();

  return normalizedName;
};
