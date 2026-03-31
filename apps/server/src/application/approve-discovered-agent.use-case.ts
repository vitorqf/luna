import type { Device } from "@luna/shared-types";
import { normalizeWhitespace } from "../utils/value";
import type { DeviceWritePort, DiscoveredAgentPort } from "./ports";
import { err, ok, type UseCaseResult } from "./result";

export interface ApproveDiscoveredAgentUseCaseDependencies {
  deviceWritePort: DeviceWritePort;
  discoveredAgentPort: DiscoveredAgentPort;
}

export type ApproveDiscoveredAgentUseCaseErrorCode =
  | "discovered_agent_not_found"
  | "name_taken";

export type ApproveDiscoveredAgentUseCaseResult = UseCaseResult<
  Device,
  ApproveDiscoveredAgentUseCaseErrorCode
>;

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
      return err("discovered_agent_not_found");
    }

    const existingDevice = this.dependencies.deviceWritePort.getById(
      normalizedDiscoveredAgentId,
    );
    if (existingDevice) {
      this.dependencies.discoveredAgentPort.removeById(normalizedDiscoveredAgentId);
      return ok(existingDevice);
    }

    const approvedName = normalizeWhitespace(discoveredAgent.hostname);
    if (
      this.dependencies.deviceWritePort.isNameTaken(
        approvedName,
        normalizedDiscoveredAgentId,
      )
    ) {
      return err("name_taken");
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

    return ok(approvedDevice);
  };
}
