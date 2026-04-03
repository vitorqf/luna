import { loadAgentRuntimeEnvFromFile, runAgentMain } from "./main";

const run = async (): Promise<void> => {
  loadAgentRuntimeEnvFromFile();
  await runAgentMain(process.env, console, process.argv.slice(2));
};

void run().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown agent runtime failure.";
  console.error(`[luna][agent] failed to start: ${message}`);
  process.exitCode = 1;
});
