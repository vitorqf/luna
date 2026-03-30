import type { Device, DiscoveredAgent } from "@luna/shared-types";
import type {
  DispatchCommandAcknowledgement,
  DispatchCommandInput,
} from "../command-dispatcher";

export interface TargetDeviceLookupPort {
  resolveByTargetName: (targetName: string) => Device | null;
}

export interface CommandDispatchPort {
  dispatch: (
    input: DispatchCommandInput,
  ) => Promise<DispatchCommandAcknowledgement>;
}

export interface DeviceWritePort {
  getById: (deviceId: string) => Device | undefined;
  save: (device: Device) => void;
  isNameTaken: (candidateName: string, excludedDeviceId: string) => boolean;
  setAlias: (deviceId: string, alias: string) => void;
}

export interface DiscoveredAgentPort {
  getById: (discoveredAgentId: string) => DiscoveredAgent | undefined;
  removeById: (discoveredAgentId: string) => void;
}
