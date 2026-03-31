import type { Device } from "@luna/shared-types";
import { normalizeWhitespace } from "../utils/value";
import type { DeviceWritePort } from "./ports";
import { err, ok, type UseCaseResult } from "./result";

export interface RenameDeviceUseCaseDependencies {
  deviceWritePort: DeviceWritePort;
}

export interface RenameDeviceUseCaseInput {
  deviceId: string;
  name: string;
}

export type RenameDeviceUseCaseErrorCode =
  | "device_not_found"
  | "name_required"
  | "name_taken";

export type RenameDeviceUseCaseResult = UseCaseResult<
  Device,
  RenameDeviceUseCaseErrorCode
>;

export class RenameDeviceUseCase {
  public constructor(
    private readonly dependencies: RenameDeviceUseCaseDependencies,
  ) {}

  public readonly execute = (
    input: RenameDeviceUseCaseInput,
  ): RenameDeviceUseCaseResult => {
    const currentDevice = this.dependencies.deviceWritePort.getById(input.deviceId);
    if (!currentDevice) {
      return err("device_not_found");
    }

    const normalizedName = normalizeWhitespace(input.name);
    if (!normalizedName) {
      return err("name_required");
    }

    if (this.dependencies.deviceWritePort.isNameTaken(normalizedName, input.deviceId)) {
      return err("name_taken");
    }

    this.dependencies.deviceWritePort.setAlias(input.deviceId, normalizedName);

    const updatedDevice: Device = {
      ...currentDevice,
      name: normalizedName,
    };
    this.dependencies.deviceWritePort.save(updatedDevice);

    return ok(updatedDevice);
  };
}
