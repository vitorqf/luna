import type { Device } from "@luna/shared-types";
import { isDeviceNameTaken } from "../utils/device";
import { normalizeWhitespace } from "../utils/value";

export interface RenameDeviceUseCaseDependencies {
  devices: Map<string, Device>;
  customDeviceAliases: Map<string, string>;
}

export interface RenameDeviceUseCaseInput {
  deviceId: string;
  name: string;
}

export type RenameDeviceUseCaseResult =
  | {
      kind: "ok";
      device: Device;
    }
  | {
      kind: "error";
      statusCode: 400 | 404 | 409;
      message: string;
    };

export class RenameDeviceUseCase {
  public constructor(
    private readonly dependencies: RenameDeviceUseCaseDependencies,
  ) {}

  public readonly execute = (
    input: RenameDeviceUseCaseInput,
  ): RenameDeviceUseCaseResult => {
    const currentDevice = this.dependencies.devices.get(input.deviceId);
    if (!currentDevice) {
      return {
        kind: "error",
        statusCode: 404,
        message: "Device not found.",
      };
    }

    const normalizedName = normalizeWhitespace(input.name);
    if (!normalizedName) {
      return {
        kind: "error",
        statusCode: 400,
        message: "name is required.",
      };
    }

    if (
      isDeviceNameTaken(
        this.dependencies.devices.values(),
        normalizedName,
        input.deviceId,
      )
    ) {
      return {
        kind: "error",
        statusCode: 409,
        message: "Device name is already in use.",
      };
    }

    this.dependencies.customDeviceAliases.set(input.deviceId, normalizedName);

    const updatedDevice: Device = {
      ...currentDevice,
      name: normalizedName,
    };
    this.dependencies.devices.set(input.deviceId, updatedDevice);

    return {
      kind: "ok",
      device: updatedDevice,
    };
  };
}
