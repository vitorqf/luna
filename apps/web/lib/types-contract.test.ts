import type {
  DeviceCapability as SharedDeviceCapability,
  DeviceStatus as SharedDeviceStatus,
} from "@luna/shared-types";
import { describe, it } from "vitest";
import type { Device, DiscoveredAgent } from "./types";

describe("web contract types", () => {
  it("aligns canonical device fields with shared types", () => {
    const validDevice: Device = {
      id: "notebook-2",
      name: "Notebook 2",
      hostname: "notebook-2.local",
      type: "notebook",
      status: "online" satisfies SharedDeviceStatus,
      capabilities: ["notify", "play_media"] satisfies SharedDeviceCapability[],
    };
    const validDiscoveredAgent: DiscoveredAgent = {
      id: "mini-pc-1",
      hostname: "mini-pc-1.local",
      capabilities: ["notify"],
    };

    const invalidDevice: Device = {
      ...validDevice,
      // @ts-expect-error web device capabilities must stay inside the shared catalog
      capabilities: ["shutdown"],
    };

    const invalidDiscoveredAgent: DiscoveredAgent = {
      ...validDiscoveredAgent,
      // @ts-expect-error discovered agent capabilities must stay inside the shared catalog
      capabilities: ["screenshot"],
    };

    void validDevice;
    void validDiscoveredAgent;
    void invalidDevice;
    void invalidDiscoveredAgent;
  });
});
