import { describe, expect, it } from "vitest";
import { RenameDeviceUseCase } from "../src/application/rename-device.use-case";

describe("rename device use case", () => {
  it("returns 404 when device does not exist", () => {
    const deviceWritePort = {
      getById: () => undefined,
      save: () => undefined,
      isNameTaken: () => false,
      setAlias: () => undefined,
    };
    const useCase = new RenameDeviceUseCase({
      deviceWritePort,
    });

    const result = useCase.execute({
      deviceId: "missing",
      name: "Sala",
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "device_not_found",
      },
    });
  });

  it("returns 409 when target name is already in use", () => {
    const currentDevice = {
      id: "notebook-2",
      name: "Notebook 2",
      hostname: "notebook-2.local",
      status: "online" as const,
      capabilities: ["notify" as const],
    };
    const deviceWritePort = {
      getById: () => currentDevice,
      save: () => undefined,
      isNameTaken: () => true,
      setAlias: () => undefined,
    };
    const useCase = new RenameDeviceUseCase({
      deviceWritePort,
    });

    const result = useCase.execute({
      deviceId: "notebook-2",
      name: "Sala",
    });

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "name_taken",
      },
    });
  });

  it("updates device name and alias when valid", () => {
    const currentDevice = {
      id: "notebook-2",
      name: "Notebook 2",
      hostname: "notebook-2.local",
      status: "online" as const,
      capabilities: ["notify" as const],
    };
    let savedDevice: unknown;
    let aliasInput: { deviceId: string; alias: string } | null = null;
    const deviceWritePort = {
      getById: () => currentDevice,
      save: (device: unknown) => {
        savedDevice = device;
      },
      isNameTaken: () => false,
      setAlias: (deviceId: string, alias: string) => {
        aliasInput = {
          deviceId,
          alias,
        };
      },
    };
    const useCase = new RenameDeviceUseCase({
      deviceWritePort,
    });

    const result = useCase.execute({
      deviceId: "notebook-2",
      name: "  Sala   Principal  ",
    });

    expect(result).toEqual({
      kind: "ok",
      data: {
        id: "notebook-2",
        name: "Sala Principal",
        hostname: "notebook-2.local",
        status: "online",
        capabilities: ["notify"],
      },
    });
    expect(aliasInput).toEqual({
      deviceId: "notebook-2",
      alias: "Sala Principal",
    });
    expect(savedDevice).toEqual({
      id: "notebook-2",
      name: "Sala Principal",
      hostname: "notebook-2.local",
      status: "online",
      capabilities: ["notify"],
    });
  });
});
