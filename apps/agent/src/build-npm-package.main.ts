import { buildAgentNpmPackage } from "./build-npm-package";

const run = async (): Promise<void> => {
  const outputRoot = await buildAgentNpmPackage();
  console.info(`[luna][agent-cli] npm package created at ${outputRoot}`);
};

void run().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown npm package build failure.";
  console.error(`[luna][agent-cli] failed: ${message}`);
  process.exitCode = 1;
});
