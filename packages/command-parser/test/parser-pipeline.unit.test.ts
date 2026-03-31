import { describe, expect, it } from "vitest";
import { parseCommandWithRuleChain } from "../src/parser-pipeline";

describe("slice 40 - parser pipeline", () => {
  it("prioritizes notify quoted rule over unquoted rule", () => {
    expect(
      parseCommandWithRuleChain('Notificar "backup no servidor" no Notebook 2')
    ).toEqual({
      intent: "notify",
      targetDeviceName: "Notebook 2",
      params: {
        title: "Luna",
        message: "backup no servidor"
      }
    });
  });

  it("prioritizes play_media quoted rule over unquoted rule", () => {
    expect(
      parseCommandWithRuleChain('Tocar "lo-fi no trabalho" no Notebook 2')
    ).toEqual({
      intent: "play_media",
      targetDeviceName: "Notebook 2",
      params: {
        mediaQuery: "lo-fi no trabalho"
      }
    });
  });

  it("keeps open_app as fallback parser rule", () => {
    expect(parseCommandWithRuleChain("Abrir Notificar no Notebook 2")).toEqual({
      intent: "open_app",
      targetDeviceName: "Notebook 2",
      params: {
        appName: "Notificar"
      }
    });
  });
});
