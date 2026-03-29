import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const fromRoot = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@luna/shared-types": fromRoot("./packages/shared-types/src/index.ts"),
      "@luna/protocol": fromRoot("./packages/protocol/src/index.ts"),
      "@luna/command-parser": fromRoot("./packages/command-parser/src/index.ts")
    }
  },
  test: {
    include: ["packages/**/*.test.ts"]
  }
});
