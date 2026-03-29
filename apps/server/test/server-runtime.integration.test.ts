import { describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadServerRuntimeEnvFromFile,
  parseServerRuntimeConfig,
  startServerRuntimeFromEnv
} from "../src/main";

describe("slice 9 - server runtime", () => {
  it("loads server runtime env values from a .env file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-env-"));
    const envFilePath = join(tempDir, ".env");

    try {
      await writeFile(
        envFilePath,
        ["LUNA_SERVER_HOST=0.0.0.0", "LUNA_SERVER_PORT=4011"].join("\n"),
        "utf-8"
      );

      const targetEnv: Record<string, string | undefined> = {};
      loadServerRuntimeEnvFromFile(envFilePath, targetEnv);

      expect(targetEnv.LUNA_SERVER_HOST).toBe("0.0.0.0");
      expect(targetEnv.LUNA_SERVER_PORT).toBe("4011");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses default runtime config when env vars are not provided", () => {
    const config = parseServerRuntimeConfig({});

    expect(config).toEqual({
      host: "127.0.0.1",
      port: 4000
    });
  });

  it("throws when port is invalid", () => {
    expect(() =>
      parseServerRuntimeConfig({
        LUNA_SERVER_PORT: "invalid"
      })
    ).toThrowError("LUNA_SERVER_PORT must be an integer between 0 and 65535.");
  });

  it("starts runtime from env and responds to GET /devices", async () => {
    const server = await startServerRuntimeFromEnv({
      LUNA_SERVER_HOST: "127.0.0.1",
      LUNA_SERVER_PORT: "0"
    });

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices`
      );

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual([]);
    } finally {
      await server.stop();
    }
  });
});
