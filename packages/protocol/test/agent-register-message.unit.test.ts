import { describe, expect, it } from "vitest";
import {
  createAgentRegisterMessage,
  parseAgentRegisterMessage
} from "../src/index";

describe("agent register message", () => {
  it("parses an agent register payload with canonical capabilities", () => {
    const serialized = JSON.stringify(
      createAgentRegisterMessage({
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app", "set_volume", "play_media"]
      })
    );

    expect(parseAgentRegisterMessage(serialized)).toEqual({
      type: "agent.register",
      payload: {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app", "set_volume", "play_media"]
      }
    });
  });

  it("rejects register payload with invalid capability", () => {
    const serialized = JSON.stringify({
      type: "agent.register",
      payload: {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "shutdown"]
      }
    });

    expect(parseAgentRegisterMessage(serialized)).toBeNull();
  });
});
