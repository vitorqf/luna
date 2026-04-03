import { describe, expect, it } from "vitest";
import {
  BOOTSTRAP_CONTRACT_VERSION,
  DEVICE_CAPABILITIES,
  isCommandFailureReason,
} from "@luna/shared-types";

describe("protocol integration with shared-types", () => {
  it("consumes the shared contract version", () => {
    expect(BOOTSTRAP_CONTRACT_VERSION).toBe("v0");
  });

  it("consumes canonical runtime catalogs and guards from shared-types", () => {
    expect(DEVICE_CAPABILITIES).toEqual([
      "notify",
      "open_app",
      "set_volume",
      "play_media",
    ]);
    expect(isCommandFailureReason("execution_error")).toBe(true);
    expect(isCommandFailureReason("timeout")).toBe(false);
  });
});
