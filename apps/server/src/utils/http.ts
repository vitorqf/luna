import type { IncomingMessage, ServerResponse } from "node:http";

const CORS_ALLOW_ORIGIN = "*";
const CORS_ALLOW_METHODS = "GET,POST,PATCH,OPTIONS";
const CORS_ALLOW_HEADERS = "content-type";

const setCorsHeaders = (response: ServerResponse): void => {
  response.setHeader("access-control-allow-origin", CORS_ALLOW_ORIGIN);
  response.setHeader("access-control-allow-methods", CORS_ALLOW_METHODS);
  response.setHeader("access-control-allow-headers", CORS_ALLOW_HEADERS);
};

export const sendJson = (
  response: ServerResponse,
  statusCode: number,
  payload: unknown,
): void => {
  setCorsHeaders(response);
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
};

export const sendNoContent = (response: ServerResponse): void => {
  setCorsHeaders(response);
  response.writeHead(204);
  response.end();
};

export const readRawRequestBody = async (
  request: IncomingMessage,
): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  return Buffer.concat(chunks).toString("utf-8");
};
