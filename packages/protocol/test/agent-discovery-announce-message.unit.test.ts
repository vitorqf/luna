import { describe, expect, it } from "vitest";
import {
  AGENT_DISCOVERY_ANNOUNCE_MESSAGE_TYPE,
  createAgentDiscoveryAnnounceMessage,
  isAgentDiscoveryAnnounceMessage,
  parseAgentDiscoveryAnnounceMessage
} from "../src/index";

describe("agent discovery announce message", () => {
  it("creates and parses a valid discovery announce message", () => {
    const message = createAgentDiscoveryAnnounceMessage({
      id: "notebook-2",
      hostname: "notebook-2.local",
      capabilities: ["notify", "open_app"]
    });

    expect(message).toEqual({
      type: AGENT_DISCOVERY_ANNOUNCE_MESSAGE_TYPE,
      payload: {
        id: "notebook-2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app"]
      }
    });

    expect(parseAgentDiscoveryAnnounceMessage(JSON.stringify(message))).toEqual(
      message
    );
  });

  it("rejects malformed discovery announce payload", () => {
    expect(
      isAgentDiscoveryAnnounceMessage({
        type: AGENT_DISCOVERY_ANNOUNCE_MESSAGE_TYPE,
        payload: {
          id: "",
          hostname: "notebook-2.local",
          capabilities: ["notify"]
        }
      })
    ).toBe(false);

    expect(
      isAgentDiscoveryAnnounceMessage({
        type: AGENT_DISCOVERY_ANNOUNCE_MESSAGE_TYPE,
        payload: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["invalid-capability"]
        }
      })
    ).toBe(false);
  });
});
