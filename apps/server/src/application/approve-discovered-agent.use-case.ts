import type { Device, DiscoveredAgent } from "@luna/shared-types";
import { isDeviceNameTaken } from "../utils/device";
import { normalizeWhitespace } from "../utils/value";

export interface ApproveDiscoveredAgentUseCaseDependencies {
  devices: Map<string, Device>;
  discoveredAgents: Map<string, DiscoveredAgent>;
}

export type ApproveDiscoveredAgentUseCaseResult =
  | {
      kind: "ok";
      device: Device;
    }
  | {
      kind: "error";
      statusCode: 404 | 409;
      message: string;
    };

export class ApproveDiscoveredAgentUseCase {
  public constructor(
    private readonly dependencies: ApproveDiscoveredAgentUseCaseDependencies,
  ) {}

  public readonly execute = (
    discoveredAgentId: string,
  ): ApproveDiscoveredAgentUseCaseResult => {
    const normalizedDiscoveredAgentId = normalizeWhitespace(discoveredAgentId);
    const discoveredAgent = this.dependencies.discoveredAgents.get(
      normalizedDiscoveredAgentId,
    );
    if (!discoveredAgent) {
      return {
        kind: "error",
        statusCode: 404,
        message: "Discovered agent not found.",
      };
    }

    const existingDevice = this.dependencies.devices.get(
      normalizedDiscoveredAgentId,
    );
    if (existingDevice) {
      this.dependencies.discoveredAgents.delete(normalizedDiscoveredAgentId);
      return {
        kind: "ok",
        device: existingDevice,
      };
    }

    const approvedName = normalizeWhitespace(discoveredAgent.hostname);
    if (
      isDeviceNameTaken(
        this.dependencies.devices.values(),
        approvedName,
        normalizedDiscoveredAgentId,
      )
    ) {
      return {
        kind: "error",
        statusCode: 409,
        message: "Device name is already in use.",
      };
    }

    const approvedDevice: Device = {
      id: normalizedDiscoveredAgentId,
      name: approvedName,
      hostname: normalizeWhitespace(discoveredAgent.hostname),
      status: "offline",
      capabilities: [...discoveredAgent.capabilities],
    };

    this.dependencies.devices.set(normalizedDiscoveredAgentId, approvedDevice);
    this.dependencies.discoveredAgents.delete(normalizedDiscoveredAgentId);

    return {
      kind: "ok",
      device: approvedDevice,
    };
  };
}
