import { describe, expect, it } from "vitest";
import type { Device } from "./types";
import {
  applyDeviceSuggestion,
  extractDeviceSuggestionContext,
  getOnlineDeviceSuggestions
} from "./device-suggestions";

const sampleDevices: Device[] = [
  {
    id: "dev-1",
    name: "Notebook 2",
    hostname: "notebook-2.local",
    type: "notebook",
    status: "online",
    capabilities: ["notify"]
  },
  {
    id: "dev-2",
    name: "Sala Notebook",
    hostname: "sala-notebook.local",
    type: "desktop",
    status: "online",
    capabilities: ["notify"]
  },
  {
    id: "dev-3",
    name: "Server Principal",
    hostname: "server-principal.local",
    type: "server",
    status: "offline",
    capabilities: ["notify"]
  }
];

describe("device suggestions helpers", () => {
  it("extracts context after the last preposition token", () => {
    expect(
      extractDeviceSuggestionContext("Avisar backup no servidor em note")
    ).toEqual({
      prefix: "Avisar backup no servidor em ",
      fragment: "note"
    });
  });

  it("returns null when there is no device preposition context", () => {
    expect(extractDeviceSuggestionContext("Abrir Spotify")).toBeNull();
  });

  it("filters only online devices and sorts prefix match first", () => {
    expect(getOnlineDeviceSuggestions(sampleDevices, "no").map((d) => d.name)).toEqual([
      "Notebook 2",
      "Sala Notebook"
    ]);
  });

  it("applies suggestion by replacing only the fragment after preposition", () => {
    const context = extractDeviceSuggestionContext("Abrir spotify no note");
    expect(context).not.toBeNull();
    expect(applyDeviceSuggestion("Abrir spotify no note", context!, "Notebook 2")).toBe(
      "Abrir spotify no Notebook 2"
    );
  });
});
