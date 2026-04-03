import { config as loadDotEnv } from "dotenv";
import type { RuntimeEnv } from "./agent-runtime-config";

export const loadAgentRuntimeEnvFromFile = (
  envFilePath = ".env",
  targetEnv: RuntimeEnv = process.env,
): void => {
  loadDotEnv({
    path: envFilePath,
    processEnv: targetEnv,
    override: false,
    quiet: true,
  });
};
