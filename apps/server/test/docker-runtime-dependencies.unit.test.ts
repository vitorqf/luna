import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const DOCKERFILE_PATH = "apps/server/Dockerfile";

describe("slice 46 - docker runtime dependencies", () => {
  it("copies required runtime dependencies into the server image", async () => {
    const dockerfileSource = await readFile(DOCKERFILE_PATH, "utf-8");

    expect(dockerfileSource).toContain(
      "COPY --from=builder /app/node_modules/dotenv ./node_modules/dotenv",
    );
    expect(dockerfileSource).toContain(
      "COPY --from=builder /app/node_modules/ws ./node_modules/ws",
    );
    expect(dockerfileSource).toContain(
      "COPY --from=builder /app/node_modules/zod ./node_modules/zod",
    );
  });
});
