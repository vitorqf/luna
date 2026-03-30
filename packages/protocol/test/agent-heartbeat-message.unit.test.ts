import { describe, expect, it } from "vitest";
import {
  createAgentHeartbeatMessage,
  parseAgentHeartbeatMessage
} from "../src/index";

describe("agent heartbeat message", () => {
  it("parses a valid heartbeat payload", () => {
    const serialized = JSON.stringify(
      createAgentHeartbeatMessage({})
    );

    expect(parseAgentHeartbeatMessage(serialized)).toEqual({
      type: "agent.heartbeat",
      payload: {}
    });
  });

  it("rejects malformed heartbeat payload", () => {
    const serialized = JSON.stringify({
      type: "agent.heartbeat"
    });

    expect(parseAgentHeartbeatMessage(serialized)).toBeNull();
  });

  it("rejects message with invalid type", () => {
    const serialized = JSON.stringify({
      type: "agent.heartbeat.invalid",
      payload: {}
    });

    expect(parseAgentHeartbeatMessage(serialized)).toBeNull();
  });
});
