import type { CommandFailureReason } from "@luna/shared-types";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createLunaApiClient, type SubmitCommandAck } from "./luna-api";

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
    vi.unstubAllGlobals();
  });

  it("uses the canonical submit acknowledgement union", () => {
    const successAck: SubmitCommandAck = {
      commandId: "cmd-1",
      targetDeviceId: "notebook-2",
      status: "success",
    };
    const failedAck: SubmitCommandAck = {
      commandId: "cmd-2",
      targetDeviceId: "notebook-2",
      status: "failed",
      reason: "execution_error" satisfies CommandFailureReason,
    };

    const invalidSuccessAck: SubmitCommandAck = {
      commandId: "cmd-3",
      targetDeviceId: "notebook-2",
      status: "success",
      // @ts-expect-error success acknowledgements must not include a failure reason
      reason: "execution_error",
    };

    // @ts-expect-error failed acknowledgements must include a canonical reason
    const invalidFailedAck: SubmitCommandAck = {
      commandId: "cmd-4",
      targetDeviceId: "notebook-2",
      status: "failed",
    };

    const invalidFailedReasonAck: SubmitCommandAck = {
      commandId: "cmd-5",
      targetDeviceId: "notebook-2",
      status: "failed",
      // @ts-expect-error failed acknowledgements reject non-canonical reasons
      reason: "timeout",
    };

    void successAck;
    void failedAck;
    void invalidSuccessAck;
    void invalidFailedAck;
    void invalidFailedReasonAck;
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
            status: "online",
            capabilities: ["notify", "open_app"]
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
        status: "online",
        capabilities: ["notify", "open_app"]
      }
    ]);
  });

  it("uses same-origin relative endpoints when base url is not configured outside browser context", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse([]));

    const client = createLunaApiClient();
    await client.fetchDevices();

    expect(fetchMock).toHaveBeenCalledWith("/devices", undefined);
  });

  it("uses the local server url during standalone web dev when base url is not configured", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(makeJsonResponse([]));

    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3000"
      }
    });

    const client = createLunaApiClient();
    await client.fetchDevices();

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4000/devices", undefined);
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

  it("renames a device with PATCH /devices/:id", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeJsonResponse({
          id: "notebook-2",
          name: "Sala",
          hostname: "notebook-2.local",
          status: "online",
          capabilities: ["notify", "open_app"]
        })
      );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const device = await client.renameDevice("notebook-2", "Sala");

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4444/devices/notebook-2", {
      method: "PATCH",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        name: "Sala"
      })
    });
    expect(device).toEqual({
      id: "notebook-2",
      name: "Sala",
      hostname: "notebook-2.local",
      status: "online",
      capabilities: ["notify", "open_app"]
    });
  });

  it("returns failed command result payload from POST /commands", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      makeJsonResponse({
        commandId: "cmd-999",
        targetDeviceId: "notebook-2",
        status: "failed",
        reason: "execution_error"
      })
    );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const ack = await client.submitCommand("Abrir Spotify no Notebook 2");

    expect(ack).toEqual({
      commandId: "cmd-999",
      targetDeviceId: "notebook-2",
      status: "failed",
      reason: "execution_error"
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

  it("fetches discovered agents from GET /discovery/agents", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeJsonResponse([
          {
            id: "mini-pc-1",
            hostname: "mini-pc-1.local",
            capabilities: ["notify"]
          }
        ])
      );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const discoveredAgents = await client.fetchDiscoveredAgents();

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4444/discovery/agents",
      undefined
    );
    expect(discoveredAgents).toEqual([
      {
        id: "mini-pc-1",
        hostname: "mini-pc-1.local",
        capabilities: ["notify"]
      }
    ]);
  });

  it("approves discovered agent via POST /discovery/agents/:id/approve", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        makeJsonResponse({
          id: "mini-pc-1",
          name: "mini-pc-1.local",
          hostname: "mini-pc-1.local",
          status: "offline",
          capabilities: ["notify"]
        })
      );

    const client = createLunaApiClient("http://127.0.0.1:4444");
    const device = await client.approveDiscoveredAgent("mini-pc-1");

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:4444/discovery/agents/mini-pc-1/approve",
      {
        method: "POST"
      }
    );
    expect(device).toEqual({
      id: "mini-pc-1",
      name: "mini-pc-1.local",
      hostname: "mini-pc-1.local",
      status: "offline",
      capabilities: ["notify"]
    });
  });
});
