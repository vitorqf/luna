import { describe, expect, it } from "vitest";
import { RenameDeviceUseCase } from "../src/application/rename-device.use-case";

describe("rename device use case", () => {
  it("returns 404 when device does not exist", () => {
    const useCase = new RenameDeviceUseCase({
      devices: new Map(),
      customDeviceAliases: new Map(),
    });

    const result = useCase.execute({
      deviceId: "missing",
      name: "Sala",
    });

    expect(result).toEqual({
      kind: "error",
      statusCode: 404,
      message: "Device not found.",
    });
  });

  it("returns 409 when target name is already in use", () => {
    const useCase = new RenameDeviceUseCase({
      devices: new Map([
        [
          "notebook-1",
          {
            id: "notebook-1",
            name: "Sala",
            hostname: "notebook-1.local",
            status: "online",
            capabilities: ["notify"],
          },
        ],
        [
          "notebook-2",
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online",
            capabilities: ["notify"],
          },
        ],
      ]),
      customDeviceAliases: new Map(),
    });

    const result = useCase.execute({
      deviceId: "notebook-2",
      name: "Sala",
    });

    expect(result).toEqual({
      kind: "error",
      statusCode: 409,
      message: "Device name is already in use.",
    });
  });

  it("updates device name and alias when valid", () => {
    const devices = new Map([
      [
        "notebook-2",
        {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          status: "online" as const,
          capabilities: ["notify" as const],
        },
      ],
    ]);
    const customDeviceAliases = new Map<string, string>();
    const useCase = new RenameDeviceUseCase({
      devices,
      customDeviceAliases,
    });

    const result = useCase.execute({
      deviceId: "notebook-2",
      name: "  Sala   Principal  ",
    });

    expect(result).toEqual({
      kind: "ok",
      device: {
        id: "notebook-2",
        name: "Sala Principal",
        hostname: "notebook-2.local",
        status: "online",
        capabilities: ["notify"],
      },
    });
    expect(customDeviceAliases.get("notebook-2")).toBe("Sala Principal");
  });
});
