import { describe, expect, it } from "vitest";
import { BOOTSTRAP_CONTRACT_VERSION } from "@luna/shared-types";

describe("protocol integration with shared-types", () => {
  it("consumes the shared contract version", () => {
    expect(BOOTSTRAP_CONTRACT_VERSION).toBe("v0");
  });
});
