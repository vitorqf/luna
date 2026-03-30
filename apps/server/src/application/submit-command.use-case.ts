import { parseCommand } from "@luna/command-parser";
import type { Device } from "@luna/shared-types";
import type {
  DispatchCommandAcknowledgement,
  DispatchCommandInput,
} from "../command-dispatcher";
import { resolveDeviceByTarget } from "../utils/device";

export interface SubmitCommandUseCaseDependencies {
  devices: Map<string, Device>;
  dispatchCommand: (
    input: DispatchCommandInput,
  ) => Promise<DispatchCommandAcknowledgement>;
}

export type SubmitCommandUseCaseResult =
  | {
      kind: "ok";
      acknowledgement: DispatchCommandAcknowledgement;
    }
  | {
      kind: "error";
      statusCode: 422 | 404 | 500;
      message: string;
    };

export class SubmitCommandUseCase {
  public constructor(
    private readonly dependencies: SubmitCommandUseCaseDependencies,
  ) {}

  public readonly execute = async (
    rawText: string,
  ): Promise<SubmitCommandUseCaseResult> => {
    const normalizedRawText = rawText.trim();
    const parsedCommand = parseCommand(normalizedRawText);
    if (!parsedCommand) {
      return {
        kind: "error",
        statusCode: 422,
        message: "Unable to parse command.",
      };
    }

    const targetDevice = resolveDeviceByTarget(
      this.dependencies.devices.values(),
      parsedCommand.targetDeviceName,
    );
    if (!targetDevice) {
      return {
        kind: "error",
        statusCode: 404,
        message: "Target device is not registered.",
      };
    }

    try {
      const acknowledgement = await this.dependencies.dispatchCommand({
        rawText: normalizedRawText,
        targetDeviceId: targetDevice.id,
        intent: parsedCommand.intent,
        params: parsedCommand.params,
      });

      return {
        kind: "ok",
        acknowledgement,
      };
    } catch {
      return {
        kind: "error",
        statusCode: 500,
        message: "Failed to dispatch command.",
      };
    }
  };
}
