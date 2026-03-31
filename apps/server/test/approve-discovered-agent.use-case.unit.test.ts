import { describe, expect, it } from "vitest";
import type { Device } from "@luna/shared-types";
import { ApproveDiscoveredAgentUseCase } from "../src/application/approve-discovered-agent.use-case";

describe("approve discovered agent use case", () => {
  it("returns 404 when discovered agent is missing", () => {
    const deviceWritePort = {
      getById: () => undefined,
      save: () => undefined,
      isNameTaken: () => false,
      setAlias: () => undefined,
    };
    const discoveredAgentPort = {
      getById: () => undefined,
      removeById: () => undefined,
    };
    const useCase = new ApproveDiscoveredAgentUseCase({
      deviceWritePort,
      discoveredAgentPort,
    });

    const result = useCase.execute("missing-agent");

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "discovered_agent_not_found",
      },
    });
  });

  it("returns 409 when approved name is already in use", () => {
    const deviceWritePort = {
      getById: () => undefined,
      save: () => undefined,
      isNameTaken: () => true,
      setAlias: () => undefined,
    };
    const discoveredAgentPort = {
      getById: () => ({
        id: "agent-1",
        hostname: "Sala",
        capabilities: ["notify" as const],
      }),
      removeById: () => undefined,
    };
    const useCase = new ApproveDiscoveredAgentUseCase({
      deviceWritePort,
      discoveredAgentPort,
    });

    const result = useCase.execute("agent-1");

    expect(result).toEqual({
      kind: "error",
      error: {
        code: "name_taken",
      },
    });
  });

  it("approves discovered agent and creates offline device", () => {
    let savedDevice: Device | null = null;
    let removedId: string | null = null;
    const deviceWritePort = {
      getById: () => undefined,
      save: (device: Device) => {
        savedDevice = device;
      },
      isNameTaken: () => false,
      setAlias: () => undefined,
    };
    const discoveredAgentPort = {
      getById: () => ({
        id: "agent-1",
        hostname: "Notebook 2",
        capabilities: ["notify" as const, "open_app" as const],
      }),
      removeById: (id: string) => {
        removedId = id;
      },
    };
    const useCase = new ApproveDiscoveredAgentUseCase({
      deviceWritePort,
      discoveredAgentPort,
    });

    const result = useCase.execute("agent-1");

    expect(result).toEqual({
      kind: "ok",
      data: {
        id: "agent-1",
        name: "Notebook 2",
        hostname: "Notebook 2",
        status: "offline",
        capabilities: ["notify", "open_app"],
      },
    });
    expect(savedDevice).toEqual({
      id: "agent-1",
      name: "Notebook 2",
      hostname: "Notebook 2",
      status: "offline",
      capabilities: ["notify", "open_app"],
    });
    expect(removedId).toBe("agent-1");
  });
});
