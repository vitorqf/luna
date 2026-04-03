import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadAgentRuntimeEnvFromFile } from "../src/agent-runtime-env";

describe("agent runtime env", () => {
  it("loads .env values without overriding existing target env values", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-agent-env-"));
    const envFilePath = join(tempDir, ".env");

    try {
      await writeFile(
        envFilePath,
        [
          "LUNA_AGENT_SERVER_URL=ws://127.0.0.1:4010",
          "LUNA_AGENT_DEVICE_ID=from-env-file",
          "LUNA_AGENT_DEVICE_NAME=From Env File",
          "LUNA_AGENT_DEVICE_HOSTNAME=from-env-file.local",
        ].join("\n"),
        "utf-8",
      );

      const targetEnv: Record<string, string | undefined> = {
        LUNA_AGENT_DEVICE_NAME: "Existing Name",
      };

      loadAgentRuntimeEnvFromFile(envFilePath, targetEnv);

      expect(targetEnv.LUNA_AGENT_SERVER_URL).toBe("ws://127.0.0.1:4010");
      expect(targetEnv.LUNA_AGENT_DEVICE_ID).toBe("from-env-file");
      expect(targetEnv.LUNA_AGENT_DEVICE_NAME).toBe("Existing Name");
      expect(targetEnv.LUNA_AGENT_DEVICE_HOSTNAME).toBe(
        "from-env-file.local",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
