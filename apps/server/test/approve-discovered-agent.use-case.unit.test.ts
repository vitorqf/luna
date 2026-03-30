import { describe, expect, it } from "vitest";
import type { Device } from "@luna/shared-types";
import { ApproveDiscoveredAgentUseCase } from "../src/application/approve-discovered-agent.use-case";

describe("approve discovered agent use case", () => {
  it("returns 404 when discovered agent is missing", () => {
    const useCase = new ApproveDiscoveredAgentUseCase({
      devices: new Map(),
      discoveredAgents: new Map(),
    });

    const result = useCase.execute("missing-agent");

    expect(result).toEqual({
      kind: "error",
      statusCode: 404,
      message: "Discovered agent not found.",
    });
  });

  it("returns 409 when approved name is already in use", () => {
    const useCase = new ApproveDiscoveredAgentUseCase({
      devices: new Map([
        [
          "notebook-1",
          {
            id: "notebook-1",
            name: "Sala",
            hostname: "notebook-1.local",
            status: "online",
            capabilities: ["notify"],
          },
        ],
      ]),
      discoveredAgents: new Map([
        [
          "agent-1",
          {
            id: "agent-1",
            hostname: "Sala",
            capabilities: ["notify"],
          },
        ],
      ]),
    });

    const result = useCase.execute("agent-1");

    expect(result).toEqual({
      kind: "error",
      statusCode: 409,
      message: "Device name is already in use.",
    });
  });

  it("approves discovered agent and creates offline device", () => {
    const devices = new Map<string, Device>();
    const discoveredAgents = new Map([
      [
        "agent-1",
        {
          id: "agent-1",
          hostname: "Notebook 2",
          capabilities: ["notify" as const, "open_app" as const],
        },
      ],
    ]);
    const useCase = new ApproveDiscoveredAgentUseCase({
      devices,
      discoveredAgents,
    });

    const result = useCase.execute("agent-1");

    expect(result).toEqual({
      kind: "ok",
      device: {
        id: "agent-1",
        name: "Notebook 2",
        hostname: "Notebook 2",
        status: "offline",
        capabilities: ["notify", "open_app"],
      },
    });
    expect(discoveredAgents.has("agent-1")).toBe(false);
  });
});
