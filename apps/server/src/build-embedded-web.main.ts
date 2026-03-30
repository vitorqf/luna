import { spawn } from "node:child_process";

const sanitizedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string"
  )
);

const run = async (): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const child =
      process.platform === "win32"
        ? spawn(
            "cmd.exe",
            ["/d", "/s", "/c", "npm --workspace apps/web run build"],
            {
              env: {
                ...sanitizedEnv,
                NEXT_PUBLIC_LUNA_SERVER_URL: "",
              },
              stdio: "inherit",
            },
          )
        : spawn("npm", ["--workspace", "apps/web", "run", "build"], {
            env: {
              ...sanitizedEnv,
              NEXT_PUBLIC_LUNA_SERVER_URL: "",
            },
            stdio: "inherit",
          });

    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`Embedded web build failed with exit code ${code ?? 1}.`));
    });
  });

void run().catch((error) => {
  const message =
    error instanceof Error ? error.message : "Unknown embedded web build failure.";
  console.error(`[luna][web-build] failed: ${message}`);
  process.exitCode = 1;
});
