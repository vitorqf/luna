import { chmod, mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { build as buildWithEsbuild } from "esbuild";

const DEFAULT_OUTPUT_DIR = join("dist-packages", "agent-cli");
const DEFAULT_PACKAGE_NAME = "@vitorqf/luna-agent";
const DEFAULT_PACKAGE_VERSION = "0.0.1";
const DEFAULT_CLI_COMMAND_NAME = "luna-agent";

export interface BundleCliEntryInput {
  entryFilePath: string;
  outputFilePath: string;
}

export interface BuildAgentNpmPackageOptions {
  projectRoot?: string;
  outputDirName?: string;
  packageName?: string;
  packageVersion?: string;
  cliCommandName?: string;
  bundleCliEntry?: ((input: BundleCliEntryInput) => Promise<void>) | undefined;
}

const defaultBundleCliEntry = async (
  input: BundleCliEntryInput,
): Promise<void> => {
  await buildWithEsbuild({
    entryPoints: [input.entryFilePath],
    outfile: input.outputFilePath,
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    sourcemap: false,
    banner: {
      js: "#!/usr/bin/env node",
    },
    logLevel: "silent",
  });
};

const createNpmPackageReadme = (
  packageName: string,
  cliCommandName: string,
): string => {
  return `# ${packageName}

CLI package for Luna Agent.

## Usage

\`\`\`bash
npm exec --yes --package ${packageName} ${cliCommandName} -- \\
  --server-host 192.168.0.10 --server-port 4000
\`\`\`

## CLI Options

- \`--server-url\`
- \`--server-host\`
- \`--server-port\`
- \`--device-id\`
- \`--device-name\`
- \`--device-hostname\`
`;
};

export const buildAgentNpmPackage = async (
  options: BuildAgentNpmPackageOptions = {},
): Promise<string> => {
  const projectRoot = resolve(options.projectRoot ?? process.cwd());
  const outputRoot = join(
    projectRoot,
    options.outputDirName ?? DEFAULT_OUTPUT_DIR,
  );
  const packageName = options.packageName ?? DEFAULT_PACKAGE_NAME;
  const packageVersion = options.packageVersion ?? DEFAULT_PACKAGE_VERSION;
  const cliCommandName = options.cliCommandName ?? DEFAULT_CLI_COMMAND_NAME;
  const bundleCliEntry = options.bundleCliEntry ?? defaultBundleCliEntry;
  const entryFilePath = join(
    projectRoot,
    "apps",
    "agent",
    "src",
    "cli-entry.ts",
  );
  const outputFilePath = join(outputRoot, "bin", `${cliCommandName}.js`);

  await rm(outputRoot, { recursive: true, force: true });
  await mkdir(join(outputRoot, "bin"), { recursive: true });

  await bundleCliEntry({
    entryFilePath,
    outputFilePath,
  });

  await chmod(outputFilePath, 0o755);

  await writeFile(
    join(outputRoot, "package.json"),
    `${JSON.stringify(
      {
        name: packageName,
        version: packageVersion,
        type: "commonjs",
        private: false,
        bin: {
          [cliCommandName]: `bin/${cliCommandName}.js`,
        },
        files: ["bin", "README.md"],
        engines: {
          node: ">=20",
        },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );

  await writeFile(
    join(outputRoot, "README.md"),
    createNpmPackageReadme(packageName, cliCommandName),
    "utf-8",
  );

  return outputRoot;
};
