import type { Device } from "@luna/shared-types";
import { normalizeWhitespace } from "../utils/value";
import type { DeviceWritePort, DiscoveredAgentPort } from "./ports";

export interface ApproveDiscoveredAgentUseCaseDependencies {
  deviceWritePort: DeviceWritePort;
  discoveredAgentPort: DiscoveredAgentPort;
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
    const discoveredAgent = this.dependencies.discoveredAgentPort.getById(
      normalizedDiscoveredAgentId,
    );
    if (!discoveredAgent) {
      return {
        kind: "error",
        statusCode: 404,
        message: "Discovered agent not found.",
      };
    }

    const existingDevice = this.dependencies.deviceWritePort.getById(
      normalizedDiscoveredAgentId,
    );
    if (existingDevice) {
      this.dependencies.discoveredAgentPort.removeById(normalizedDiscoveredAgentId);
      return {
        kind: "ok",
        device: existingDevice,
      };
    }

    const approvedName = normalizeWhitespace(discoveredAgent.hostname);
    if (
      this.dependencies.deviceWritePort.isNameTaken(
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

    this.dependencies.deviceWritePort.save(approvedDevice);
    this.dependencies.discoveredAgentPort.removeById(normalizedDiscoveredAgentId);

    return {
      kind: "ok",
      device: approvedDevice,
    };
  };
}
