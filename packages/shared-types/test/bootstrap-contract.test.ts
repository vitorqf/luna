import { describe, expect, it } from "vitest";
import { BOOTSTRAP_CONTRACT_VERSION } from "../src/index";

describe("shared-types bootstrap contract", () => {
  it("exports the baseline contract version", () => {
    expect(BOOTSTRAP_CONTRACT_VERSION).toBe("v0");
  });
});
