import { afterEach, describe, expect, it, vi } from "vitest";
import { createLunaApiClient } from "./luna-api";

const makeJsonResponse = (payload: unknown, status = 200): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json"
    }
  });

describe("luna api client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetches devices from GET /devices", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeJsonResponse([
          {
            id: "notebook-2",
            name: "Notebook 2",
            hostname: "notebook-2.local",
            status: "online"
          }
        ])
      );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const devices = await client.fetchDevices();

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4444/devices", undefined);
    expect(devices).toEqual([
      {
        id: "notebook-2",
        name: "Notebook 2",
        hostname: "notebook-2.local",
        status: "online"
      }
    ]);
  });

  it("submits command text to POST /commands", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeJsonResponse({
          commandId: "cmd-123",
          targetDeviceId: "notebook-2",
          status: "success"
        })
      );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const ack = await client.submitCommand("Abrir Spotify no Notebook 2");

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4444/commands", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        rawText: "Abrir Spotify no Notebook 2"
      })
    });
    expect(ack).toEqual({
      commandId: "cmd-123",
      targetDeviceId: "notebook-2",
      status: "success"
    });
  });

  it("returns failed command result payload from POST /commands", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse({
        commandId: "cmd-999",
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "open_app launcher failed"
      })
    );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const ack = await client.submitCommand("Abrir Spotify no Notebook 2");

    expect(ack).toEqual({
      commandId: "cmd-999",
      targetDeviceId: "notebook-2",
      status: "failed",
      reason: "open_app launcher failed"
    });
  });

  it("throws server message when request fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse(
        {
          message: "Unable to parse command."
        },
        422
      )
    );

    const client = createLunaApiClient("http://127.0.0.1:4444");

    await expect(
      client.submitCommand("Comando invalido")
    ).rejects.toThrowError("Unable to parse command.");
  });
});
