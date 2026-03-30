import { parseCommand } from "@luna/command-parser";
import type { DispatchCommandAcknowledgement } from "../command-dispatcher";
import type {
  CommandDispatchPort,
  TargetDeviceLookupPort,
} from "./ports";

export interface SubmitCommandUseCaseDependencies {
  targetDeviceLookupPort: TargetDeviceLookupPort;
  commandDispatchPort: CommandDispatchPort;
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

    const targetDevice = this.dependencies.targetDeviceLookupPort.resolveByTargetName(
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
      const acknowledgement = await this.dependencies.commandDispatchPort.dispatch(
        {
          rawText: normalizedRawText,
          targetDeviceId: targetDevice.id,
          intent: parsedCommand.intent,
          params: parsedCommand.params,
        },
      );

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
