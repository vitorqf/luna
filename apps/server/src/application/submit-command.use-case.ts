import { parseCommand } from "@luna/command-parser";
import type { DispatchCommandAcknowledgement } from "../command-dispatcher";
import type {
  CommandDispatchPort,
  TargetDeviceLookupPort,
} from "./ports";
import { err, ok, type UseCaseResult } from "./result";

export interface SubmitCommandUseCaseDependencies {
  targetDeviceLookupPort: TargetDeviceLookupPort;
  commandDispatchPort: CommandDispatchPort;
}

export type SubmitCommandUseCaseErrorCode =
  | "parse_failed"
  | "target_not_found"
  | "dispatch_failed";

export type SubmitCommandUseCaseResult = UseCaseResult<
  DispatchCommandAcknowledgement,
  SubmitCommandUseCaseErrorCode
>;

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
      return err("parse_failed");
    }

    const targetDevice = this.dependencies.targetDeviceLookupPort.resolveByTargetName(
      parsedCommand.targetDeviceName,
    );
    if (!targetDevice) {
      return err("target_not_found");
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

      return ok(acknowledgement);
    } catch {
      return err("dispatch_failed");
    }
  };
}
