import { describe, expect, it } from "vitest";
import {
  bumpPatchVersion,
  bumpVersionFromPackageJsonSource,
  readVersionFromPackageJsonSource,
} from "../src/agent-package-version";

describe("slice 53 - agent npm version bump workflow", () => {
  it("bumps patch version keeping major and minor", () => {
    expect(bumpPatchVersion("0.0.0")).toBe("0.0.1");
    expect(bumpPatchVersion("2.5.9")).toBe("2.5.10");
  });

  it("reads and updates version from package.json source", () => {
    const packageJsonSource = `${JSON.stringify(
      {
        name: "@luna/agent",
        version: "1.4.2",
        private: true,
      },
      null,
      2,
    )}\n`;

    const version = readVersionFromPackageJsonSource(packageJsonSource);
    expect(version).toBe("1.4.2");

    const nextPackageJsonSource =
      bumpVersionFromPackageJsonSource(packageJsonSource);
    expect(readVersionFromPackageJsonSource(nextPackageJsonSource)).toBe(
      "1.4.3",
    );
  });

  it("fails for invalid semver version", () => {
    expect(() => bumpPatchVersion("1.0")).toThrow("Invalid semver version");
    expect(() => bumpPatchVersion("1.0.0-beta.1")).toThrow(
      "Invalid semver version",
    );
  });
});
