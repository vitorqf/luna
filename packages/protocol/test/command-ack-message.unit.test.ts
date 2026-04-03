import { describe, expect, it } from "vitest";
import {
  COMMAND_ACK_STATUS_FAILED,
  COMMAND_ACK_STATUS_SUCCESS,
  createCommandAckMessage,
  parseCommandAckMessage
} from "../src/index";

describe("command ack message", () => {
  it("parses a success ack payload", () => {
    const serialized = JSON.stringify(
      createCommandAckMessage({
        commandId: "cmd-1",
        status: COMMAND_ACK_STATUS_SUCCESS
      })
    );

    expect(parseCommandAckMessage(serialized)).toEqual({
      type: "command.ack",
      payload: {
        commandId: "cmd-1",
        status: "success"
      }
    });
  });

  it("parses a failed ack payload with reason", () => {
    const serialized = JSON.stringify(
      createCommandAckMessage({
        commandId: "cmd-2",
        status: COMMAND_ACK_STATUS_FAILED,
        reason: "execution_error"
      })
    );

    expect(parseCommandAckMessage(serialized)).toEqual({
      type: "command.ack",
      payload: {
        commandId: "cmd-2",
        status: "failed",
        reason: "execution_error"
      }
    });
  });

  it("rejects failed ack payload without reason", () => {
    const serialized = JSON.stringify({
      type: "command.ack",
      payload: {
        commandId: "cmd-3",
        status: "failed"
      }
    });

    expect(parseCommandAckMessage(serialized)).toBeNull();
  });

  it("rejects failed ack payload with non-canonical reason", () => {
    const serialized = JSON.stringify({
      type: "command.ack",
      payload: {
        commandId: "cmd-4",
        status: "failed",
        reason: "timeout"
      }
    });

    expect(parseCommandAckMessage(serialized)).toBeNull();
  });
});
