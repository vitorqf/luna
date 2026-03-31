import { readFile, stat } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const CONTENT_TYPE_BY_EXTENSION: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

const isPathInsideRoot = (rootDir: string, candidatePath: string): boolean =>
  candidatePath === rootDir ||
  candidatePath.startsWith(`${rootDir}${sep}`);

const resolveRequestedAssetPath = (
  rootDir: string,
  requestUrl: string
): string | null => {
  let pathname: string;

  try {
    pathname = new URL(requestUrl, "http://localhost").pathname;
  } catch {
    return null;
  }

  let decodedPathname: string;
  try {
    decodedPathname = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const relativePath =
    decodedPathname === "/"
      ? "index.html"
      : decodedPathname.replace(/^\/+/, "");
  const candidatePath = resolve(rootDir, relativePath);

  if (!isPathInsideRoot(rootDir, candidatePath)) {
    return null;
  }

  return candidatePath;
};

const resolveExistingAssetPath = async (
  rootDir: string,
  requestUrl: string
): Promise<string | null> => {
  const candidatePath = resolveRequestedAssetPath(rootDir, requestUrl);
  if (!candidatePath) {
    return null;
  }

  try {
    const candidateStats = await stat(candidatePath);
    if (candidateStats.isFile()) {
      return candidatePath;
    }

    if (!candidateStats.isDirectory()) {
      return null;
    }

    const indexPath = join(candidatePath, "index.html");
    const indexStats = await stat(indexPath);
    return indexStats.isFile() ? indexPath : null;
  } catch {
    return null;
  }
};

const resolveContentType = (filePath: string): string =>
  CONTENT_TYPE_BY_EXTENSION[extname(filePath).toLowerCase()] ??
  "application/octet-stream";

export const serveStaticAsset = async (input: {
  request: IncomingMessage;
  response: ServerResponse;
  staticDir: string | undefined;
}): Promise<boolean> => {
  if (!input.staticDir || input.request.method !== "GET" || !input.request.url) {
    return false;
  }

  const assetPath = await resolveExistingAssetPath(
    input.staticDir,
    input.request.url
  );
  if (!assetPath) {
    return false;
  }

  const assetContents = await readFile(assetPath);
  input.response.writeHead(200, {
    "content-type": resolveContentType(assetPath)
  });
  input.response.end(assetContents);
  return true;
};
