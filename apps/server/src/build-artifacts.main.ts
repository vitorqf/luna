import { createBuildArtifact, type BuildArtifactTarget } from "./build-artifacts";

const isBuildArtifactTarget = (
  value: string | undefined,
): value is BuildArtifactTarget => value === "server" || value === "agent";

const run = async (): Promise<void> => {
  const targetArg = process.argv[2];
  if (!isBuildArtifactTarget(targetArg)) {
    throw new Error("Usage: tsx apps/server/src/build-artifacts.main.ts <server|agent>");
  }

  const artifactRoot = await createBuildArtifact(targetArg);
  console.info(`[luna][artifacts] ${targetArg} artifact created at ${artifactRoot}`);
};

void run().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown artifact build failure.";
  console.error(`[luna][artifacts] failed: ${message}`);
  process.exitCode = 1;
});
