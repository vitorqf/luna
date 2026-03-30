import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  loadServerRuntimeEnvFromFile,
  parseServerRuntimeConfig,
  startServerRuntimeFromEnv
} from "../src/main";

const writeFixtureFile = async (
  filePath: string,
  contents: string
): Promise<void> => {
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, contents, "utf-8");
};

describe("slice 9 - server runtime", () => {
  it("loads server runtime env values from a .env file", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-env-"));
    const envFilePath = join(tempDir, ".env");

    try {
      await writeFile(
        envFilePath,
        [
          "LUNA_SERVER_HOST=0.0.0.0",
          "LUNA_SERVER_PORT=4011",
          "LUNA_SERVER_STATIC_DIR=./static-web"
        ].join("\n"),
        "utf-8"
      );

      const targetEnv: Record<string, string | undefined> = {};
      loadServerRuntimeEnvFromFile(envFilePath, targetEnv);

      expect(targetEnv.LUNA_SERVER_HOST).toBe("0.0.0.0");
      expect(targetEnv.LUNA_SERVER_PORT).toBe("4011");
      expect(targetEnv.LUNA_SERVER_STATIC_DIR).toBe("./static-web");
      expect(targetEnv.LUNA_SERVER_STATE_FILE).toBeUndefined();
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("uses default runtime config when env vars are not provided", () => {
    const config = parseServerRuntimeConfig({});

    expect(config).toEqual({
      host: "127.0.0.1",
      port: 4000,
      staticDir: undefined,
      stateFile: join(process.cwd(), "data", "server-state.json")
    });
  });

  it("throws when port is invalid", () => {
    expect(() =>
      parseServerRuntimeConfig({
        LUNA_SERVER_PORT: "invalid"
      })
    ).toThrowError("LUNA_SERVER_PORT must be an integer between 0 and 65535.");
  });

  it("resolves the configured static dir from env", () => {
    const config = parseServerRuntimeConfig({
      LUNA_SERVER_STATIC_DIR: "apps/web/out"
    });

    expect(config.staticDir).toBe(join(process.cwd(), "apps/web/out"));
  });

  it("resolves the configured state file from env", () => {
    const config = parseServerRuntimeConfig({
      LUNA_SERVER_STATE_FILE: "tmp/server-state.json"
    });

    expect(config.stateFile).toBe(join(process.cwd(), "tmp", "server-state.json"));
  });

  it("throws when the configured static dir does not exist", async () => {
    await expect(
      startServerRuntimeFromEnv({
        LUNA_SERVER_HOST: "127.0.0.1",
        LUNA_SERVER_PORT: "0",
        LUNA_SERVER_STATIC_DIR: join(process.cwd(), "missing-static-dir")
      })
    ).rejects.toThrowError(
      "LUNA_SERVER_STATIC_DIR must point to an existing directory."
    );
  });

  it("fails to start when the configured state file is corrupted", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");

    try {
      await writeFile(stateFile, "{not-json", "utf-8");

      await expect(
        startServerRuntimeFromEnv({
          LUNA_SERVER_HOST: "127.0.0.1",
          LUNA_SERVER_PORT: "0",
          LUNA_SERVER_STATE_FILE: stateFile
        })
      ).rejects.toThrowError("Server state file is not valid JSON.");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
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

  it("serves embedded web assets from the configured static dir and keeps REST endpoints working", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-static-"));
    const staticDir = join(tempDir, "web");
    const siblingFilePath = join(tempDir, "secret.txt");

    await writeFixtureFile(
      join(staticDir, "index.html"),
      "<!doctype html><html><body>Luna Embedded</body></html>"
    );
    await writeFixtureFile(
      join(staticDir, "_next/static/chunks/app.js"),
      'console.log("embedded");'
    );
    await writeFixtureFile(siblingFilePath, "secret");

    const server = await startServerRuntimeFromEnv({
      LUNA_SERVER_HOST: "127.0.0.1",
      LUNA_SERVER_PORT: "0",
      LUNA_SERVER_STATIC_DIR: staticDir
    });

    try {
      const homeResponse = await fetch(`http://127.0.0.1:${server.getPort()}/`);
      expect(homeResponse.status).toBe(200);
      expect(homeResponse.headers.get("content-type")).toContain("text/html");
      await expect(homeResponse.text()).resolves.toContain("Luna Embedded");

      const assetResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/_next/static/chunks/app.js`
      );
      expect(assetResponse.status).toBe(200);
      expect(assetResponse.headers.get("content-type")).toContain(
        "text/javascript"
      );
      await expect(assetResponse.text()).resolves.toContain("embedded");

      const devicesResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices`
      );
      expect(devicesResponse.status).toBe(200);
      await expect(devicesResponse.json()).resolves.toEqual([]);

      const traversalResponse = await fetch(
        `http://127.0.0.1:${server.getPort()}/..%2Fsecret.txt`
      );
      expect(traversalResponse.status).toBe(404);
    } finally {
      await server.stop();
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
