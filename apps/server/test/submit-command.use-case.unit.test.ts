import { describe, expect, it, vi } from "vitest";
import { SubmitCommandUseCase } from "../src/application/submit-command.use-case";

describe("submit command use case", () => {
  it("returns 422 when raw text cannot be parsed", async () => {
    const useCase = new SubmitCommandUseCase({
      devices: new Map(),
      dispatchCommand: vi.fn(),
    });

    const result = await useCase.execute("comando invalido");

    expect(result).toEqual({
      kind: "error",
      statusCode: 422,
      message: "Unable to parse command.",
    });
  });

  it("returns 404 when target device is not registered", async () => {
    const useCase = new SubmitCommandUseCase({
      devices: new Map(),
      dispatchCommand: vi.fn(),
    });

    const result = await useCase.execute("Abrir Spotify no Notebook 2");

    expect(result).toEqual({
      kind: "error",
      statusCode: 404,
      message: "Target device is not registered.",
    });
  });

  it("dispatches parsed command and returns acknowledgement", async () => {
    const dispatchCommand = vi.fn(async () => ({
      commandId: "command-1",
      targetDeviceId: "notebook-2",
      status: "success" as const,
    }));
    const devices = new Map([
      [
        "notebook-2",
        {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          status: "online" as const,
          capabilities: ["open_app" as const],
        },
      ],
    ]);
    const useCase = new SubmitCommandUseCase({
      devices,
      dispatchCommand,
    });

    const result = await useCase.execute("Abrir Spotify no Notebook 2");

    expect(dispatchCommand).toHaveBeenCalledTimes(1);
    expect(dispatchCommand).toHaveBeenCalledWith({
      rawText: "Abrir Spotify no Notebook 2",
      targetDeviceId: "notebook-2",
      intent: "open_app",
      params: {
        appName: "Spotify",
      },
    });
    expect(result).toEqual({
      kind: "ok",
      acknowledgement: {
        commandId: "command-1",
        targetDeviceId: "notebook-2",
        status: "success",
      },
    });
  });
});
