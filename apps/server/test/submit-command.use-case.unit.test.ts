import { describe, expect, it, vi } from "vitest";
import { SubmitCommandUseCase } from "../src/application/submit-command.use-case";

describe("submit command use case", () => {
  it("returns 422 when raw text cannot be parsed", async () => {
    const targetDeviceLookupPort = {
      resolveByTargetName: vi.fn(() => null),
    };
    const commandDispatchPort = {
      dispatch: vi.fn(),
    };
    const useCase = new SubmitCommandUseCase({
      targetDeviceLookupPort,
      commandDispatchPort,
    });

    const result = await useCase.execute("comando invalido");

    expect(targetDeviceLookupPort.resolveByTargetName).not.toHaveBeenCalled();
    expect(commandDispatchPort.dispatch).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "error",
      error: {
        code: "parse_failed",
      },
    });
  });

  it("returns 404 when target device is not registered", async () => {
    const targetDeviceLookupPort = {
      resolveByTargetName: vi.fn(() => null),
    };
    const commandDispatchPort = {
      dispatch: vi.fn(),
    };
    const useCase = new SubmitCommandUseCase({
      targetDeviceLookupPort,
      commandDispatchPort,
    });

    const result = await useCase.execute("Abrir Spotify no Notebook 2");

    expect(targetDeviceLookupPort.resolveByTargetName).toHaveBeenCalledWith(
      "Notebook 2",
    );
    expect(commandDispatchPort.dispatch).not.toHaveBeenCalled();
    expect(result).toEqual({
      kind: "error",
      error: {
        code: "target_not_found",
      },
    });
  });

  it("dispatches parsed command and returns acknowledgement", async () => {
    const commandDispatchPort = {
      dispatch: vi.fn(async () => ({
        commandId: "command-1",
        targetDeviceId: "notebook-2",
        status: "success" as const,
      })),
    };
    const targetDeviceLookupPort = {
      resolveByTargetName: vi.fn(() => ({
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        status: "online" as const,
        capabilities: ["open_app" as const],
      })),
    };
    const useCase = new SubmitCommandUseCase({
      targetDeviceLookupPort,
      commandDispatchPort,
    });

    const result = await useCase.execute("Abrir Spotify no Notebook 2");

    expect(targetDeviceLookupPort.resolveByTargetName).toHaveBeenCalledWith(
      "Notebook 2",
    );
    expect(commandDispatchPort.dispatch).toHaveBeenCalledTimes(1);
    expect(commandDispatchPort.dispatch).toHaveBeenCalledWith({
      rawText: "Abrir Spotify no Notebook 2",
      targetDeviceId: "notebook-2",
      intent: "open_app",
      params: {
        appName: "Spotify",
      },
    });
    expect(result).toEqual({
      kind: "ok",
      data: {
        commandId: "command-1",
        targetDeviceId: "notebook-2",
        status: "success",
      },
    });
  });

  it("returns 500 when dispatch throws", async () => {
    const commandDispatchPort = {
      dispatch: vi.fn(async () => {
        throw new Error("boom");
      }),
    };
    const targetDeviceLookupPort = {
      resolveByTargetName: vi.fn(() => ({
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        status: "online" as const,
        capabilities: ["open_app" as const],
      })),
    };
    const useCase = new SubmitCommandUseCase({
      targetDeviceLookupPort,
      commandDispatchPort,
    });

    const result = await useCase.execute("Abrir Spotify no Notebook 2");

    expect(commandDispatchPort.dispatch).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      kind: "error",
      error: {
        code: "dispatch_failed",
      },
    });
  });
});
