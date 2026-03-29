import { describe, expect, it } from "vitest";
import { parseCommand } from "../src/index";

describe("slice 3 - command parser", () => {
  it("parses an open_app command from a simple phrase", () => {
    expect(parseCommand("Abrir Spotify no Notebook 2")).toEqual({
      intent: "open_app",
      targetDeviceName: "Notebook 2",
      params: {
        appName: "Spotify"
      }
    });
  });

  it("parses the same command with extra spaces and mixed case", () => {
    expect(parseCommand("  aBrIr    VLC   no   notebook sala  ")).toEqual({
      intent: "open_app",
      targetDeviceName: "notebook sala",
      params: {
        appName: "VLC"
      }
    });
  });

  it("returns null for unsupported phrases", () => {
    expect(parseCommand("Qual o clima hoje?")).toBeNull();
  });

  it('parses notify with quoted message in format `Notificar "mensagem" no <device>`', () => {
    expect(parseCommand('Notificar "Backup concluido" no Notebook 2')).toEqual({
      intent: "notify",
      targetDeviceName: "Notebook 2",
      params: {
        title: "Luna",
        message: "Backup concluido"
      }
    });
  });

  it("returns null for notify phrase without double quotes", () => {
    expect(parseCommand("Notificar Backup concluido no Notebook 2")).toBeNull();
  });

  it("returns null for notify phrase with empty quoted message", () => {
    expect(parseCommand('Notificar "   " no Notebook 2')).toBeNull();
  });

  it("returns null for notify phrase without target device", () => {
    expect(parseCommand('Notificar "Backup concluido" no   ')).toBeNull();
  });
});
