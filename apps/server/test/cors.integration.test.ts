import { describe, expect, it } from "vitest";
import { createLunaServer } from "../src/index";

describe("slice 10 - cors", () => {
  it("includes CORS headers on GET /devices", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/devices`,
        {
          headers: {
            origin: "http://localhost:3001"
          }
        }
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toContain("GET");
    } finally {
      await server.stop();
    }
  });

  it("handles preflight OPTIONS /commands", async () => {
    const server = createLunaServer({ host: "127.0.0.1", port: 0 });
    await server.start();

    try {
      const response = await fetch(
        `http://127.0.0.1:${server.getPort()}/commands`,
        {
          method: "OPTIONS",
          headers: {
            origin: "http://localhost:3001",
            "access-control-request-method": "POST",
            "access-control-request-headers": "content-type"
          }
        }
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toContain("POST");
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "content-type"
      );
    } finally {
      await server.stop();
    }
  });
});
