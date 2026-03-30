import type { Device } from "@luna/shared-types";
import { normalizeWhitespace } from "../utils/value";
import type { DeviceWritePort } from "./ports";

export interface RenameDeviceUseCaseDependencies {
  deviceWritePort: DeviceWritePort;
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
    const currentDevice = this.dependencies.deviceWritePort.getById(input.deviceId);
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

    if (this.dependencies.deviceWritePort.isNameTaken(normalizedName, input.deviceId)) {
      return {
        kind: "error",
        statusCode: 409,
        message: "Device name is already in use.",
      };
    }

    this.dependencies.deviceWritePort.setAlias(input.deviceId, normalizedName);

    const updatedDevice: Device = {
      ...currentDevice,
      name: normalizedName,
    };
    this.dependencies.deviceWritePort.save(updatedDevice);

    return {
      kind: "ok",
      device: updatedDevice,
    };
  };
}
