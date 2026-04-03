import type { CommandFailureReason } from "@luna/shared-types";
import { describe, it } from "vitest";
import type { DispatchCommandAcknowledgement } from "../src/command-dispatcher";

describe("command dispatcher contract", () => {
  it("uses the canonical acknowledgement result union", () => {
    const successAck: DispatchCommandAcknowledgement = {
      commandId: "cmd-1",
      targetDeviceId: "notebook-2",
      status: "success",
    };
    const failedAck: DispatchCommandAcknowledgement = {
      commandId: "cmd-2",
      targetDeviceId: "notebook-2",
      status: "failed",
      reason: "unsupported_intent" satisfies CommandFailureReason,
    };

    const invalidSuccessAck: DispatchCommandAcknowledgement = {
      commandId: "cmd-3",
      targetDeviceId: "notebook-2",
      status: "success",
      // @ts-expect-error success acknowledgements must not carry a failure reason
      reason: "execution_error",
    };

    // @ts-expect-error failed acknowledgements must include a canonical reason
    const invalidFailedAck: DispatchCommandAcknowledgement = {
      commandId: "cmd-4",
      targetDeviceId: "notebook-2",
      status: "failed",
    };

    const invalidFailedReasonAck: DispatchCommandAcknowledgement = {
      commandId: "cmd-5",
      targetDeviceId: "notebook-2",
      status: "failed",
      // @ts-expect-error failed acknowledgements reject non-canonical reasons
      reason: "timeout",
    };

    void successAck;
    void failedAck;
    void invalidSuccessAck;
    void invalidFailedAck;
    void invalidFailedReasonAck;
  });
});
