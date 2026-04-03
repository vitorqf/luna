export const SEMVER_PATTERN = /^(\d+)\.(\d+)\.(\d+)$/;

const parseSemver = (
  version: string,
): { major: number; minor: number; patch: number } | undefined => {
  const trimmedVersion = version.trim();
  const match = SEMVER_PATTERN.exec(trimmedVersion);
  if (!match) {
    return undefined;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

export const bumpPatchVersion = (version: string): string => {
  const parsedVersion = parseSemver(version);
  if (!parsedVersion) {
    throw new Error("Invalid semver version");
  }

  return `${parsedVersion.major}.${parsedVersion.minor}.${parsedVersion.patch + 1}`;
};

type PackageJsonWithVersion = {
  version?: unknown;
};

const parsePackageJson = (packageJsonSource: string): PackageJsonWithVersion => {
  const parsed = JSON.parse(packageJsonSource) as unknown;
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid package.json source");
  }

  return parsed as PackageJsonWithVersion;
};

export const readVersionFromPackageJsonSource = (
  packageJsonSource: string,
): string => {
  const packageJson = parsePackageJson(packageJsonSource);
  if (typeof packageJson.version !== "string") {
    throw new Error("package.json version must be a string");
  }

  return packageJson.version;
};

export const bumpVersionFromPackageJsonSource = (
  packageJsonSource: string,
): string => {
  const packageJson = parsePackageJson(packageJsonSource);
  const currentVersion = readVersionFromPackageJsonSource(packageJsonSource);
  const nextVersion = bumpPatchVersion(currentVersion);

  const nextPackageJson = {
    ...packageJson,
    version: nextVersion,
  };

  return `${JSON.stringify(nextPackageJson, null, 2)}\n`;
};
