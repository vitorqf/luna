import { DEVICE_CAPABILITIES } from "@luna/shared-types";
import { describe, expect, it } from "vitest";
import { commandPlaceholders, mockDevices } from "./mock-data";

describe("mock data", () => {
  it("keeps mock device capabilities inside the canonical shared catalog", () => {
    expect(
      mockDevices.every((device) =>
        device.capabilities.every((capability) =>
          DEVICE_CAPABILITIES.includes(capability),
        ),
      ),
    ).toBe(true);
  });

  it("keeps command placeholders inside the current MVP intent set", () => {
    expect(commandPlaceholders).not.toContain("Desligue o Desktop Sala");
  });
});
