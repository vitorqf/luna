import { describe, expect, it, vi } from "vitest";
import {
  cancelDeviceRename,
  createEditingDeviceRenameState,
  executeDeviceRenameFlow
} from "./device-rename-flow";

describe("device rename flow", () => {
  it("submits alias rename and refreshes dashboard", async () => {
    const renameDevice = vi.fn(async () => undefined);
    const refreshDashboard = vi.fn(async () => undefined);

    const normalizedName = await executeDeviceRenameFlow({
      deviceId: "notebook-2",
      draftName: "  Sala   Notebook  ",
      renameDevice,
      refreshDashboard
    });

    expect(normalizedName).toBe("Sala Notebook");
    expect(renameDevice).toHaveBeenCalledTimes(1);
    expect(renameDevice).toHaveBeenCalledWith("notebook-2", "Sala Notebook");
    expect(refreshDashboard).toHaveBeenCalledTimes(1);
  });

  it("does not submit when alias is empty after normalization", async () => {
    const renameDevice = vi.fn(async () => undefined);
    const refreshDashboard = vi.fn(async () => undefined);

    await expect(
      executeDeviceRenameFlow({
        deviceId: "notebook-2",
        draftName: "   ",
        renameDevice,
        refreshDashboard
      })
    ).rejects.toThrowError("Device name is required.");

    expect(renameDevice).not.toHaveBeenCalled();
    expect(refreshDashboard).not.toHaveBeenCalled();
  });

  it("propagates rename error and skips refresh", async () => {
    const renameDevice = vi.fn(async () => {
      throw new Error("Device name is already in use.");
    });
    const refreshDashboard = vi.fn(async () => undefined);

    await expect(
      executeDeviceRenameFlow({
        deviceId: "notebook-2",
        draftName: "Sala",
        renameDevice,
        refreshDashboard
      })
    ).rejects.toThrowError("Device name is already in use.");

    expect(renameDevice).toHaveBeenCalledTimes(1);
    expect(refreshDashboard).not.toHaveBeenCalled();
  });

  it("resets draft on cancel", () => {
    expect(createEditingDeviceRenameState("Notebook 2")).toEqual({
      isEditing: true,
      draftName: "Notebook 2",
      errorMessage: null
    });

    expect(cancelDeviceRename("  Notebook   2 ")).toEqual({
      isEditing: false,
      draftName: "Notebook 2",
      errorMessage: null
    });
  });
});
