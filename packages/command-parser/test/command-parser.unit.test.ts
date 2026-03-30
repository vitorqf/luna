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

  it("parses notify phrase without double quotes", () => {
    expect(parseCommand("Notificar Backup concluido no Notebook 2")).toEqual({
      intent: "notify",
      targetDeviceName: "Notebook 2",
      params: {
        title: "Luna",
        message: "Backup concluido"
      }
    });
  });

  it("returns null for notify phrase with empty quoted message", () => {
    expect(parseCommand('Notificar "   " no Notebook 2')).toBeNull();
  });

  it("returns null for notify phrase without target device", () => {
    expect(parseCommand('Notificar "Backup concluido" no   ')).toBeNull();
  });

  it("parses set_volume with percent suffix", () => {
    expect(parseCommand("Definir volume para 50% no Notebook 2")).toEqual({
      intent: "set_volume",
      targetDeviceName: "Notebook 2",
      params: {
        volumePercent: 50
      }
    });
  });

  it("parses set_volume without percent suffix", () => {
    expect(parseCommand("Definir volume para 27 no Notebook 2")).toEqual({
      intent: "set_volume",
      targetDeviceName: "Notebook 2",
      params: {
        volumePercent: 27
      }
    });
  });

  it("returns null for set_volume with decimal value", () => {
    expect(parseCommand("Definir volume para 27.5% no Notebook 2")).toBeNull();
  });

  it("returns null for set_volume out of 0..100 range", () => {
    expect(parseCommand("Definir volume para 150% no Notebook 2")).toBeNull();
  });

  it("returns null for set_volume phrase without target device", () => {
    expect(parseCommand("Definir volume para 50% no   ")).toBeNull();
  });

  it('parses play_media with quoted text in format `Tocar "midia" no <device>`', () => {
    expect(parseCommand('Tocar "lo-fi" no Notebook 2')).toEqual({
      intent: "play_media",
      targetDeviceName: "Notebook 2",
      params: {
        mediaQuery: "lo-fi"
      }
    });
  });

  it("parses play_media with quoted URL", () => {
    expect(
      parseCommand('Tocar "https://example.com/audio.mp3" no Notebook 2')
    ).toEqual({
      intent: "play_media",
      targetDeviceName: "Notebook 2",
      params: {
        mediaQuery: "https://example.com/audio.mp3"
      }
    });
  });

  it("parses play_media phrase without double quotes", () => {
    expect(parseCommand("Tocar lo-fi no Notebook 2")).toEqual({
      intent: "play_media",
      targetDeviceName: "Notebook 2",
      params: {
        mediaQuery: "lo-fi"
      }
    });
  });

  it("returns null for play_media phrase with empty quoted media", () => {
    expect(parseCommand('Tocar "   " no Notebook 2')).toBeNull();
  });

  it("returns null for play_media phrase without target device", () => {
    expect(parseCommand('Tocar "lo-fi" no   ')).toBeNull();
  });

  it("parses open_app with synonym verb, optional article and `em` separator", () => {
    expect(parseCommand("Abre o Spotify em Notebook 2")).toEqual({
      intent: "open_app",
      targetDeviceName: "Notebook 2",
      params: {
        appName: "Spotify"
      }
    });
  });

  it("parses notify without quotes using fixed synonym prefix", () => {
    expect(parseCommand("Enviar notificacao Backup concluido no Notebook 2")).toEqual({
      intent: "notify",
      targetDeviceName: "Notebook 2",
      params: {
        title: "Luna",
        message: "Backup concluido"
      }
    });
  });

  it("parses play_media without quotes using fixed synonym verb", () => {
    expect(parseCommand("Reproduzir lo-fi em Notebook 2")).toEqual({
      intent: "play_media",
      targetDeviceName: "Notebook 2",
      params: {
        mediaQuery: "lo-fi"
      }
    });
  });

  it("parses set_volume with synonym verb and `em` target separator", () => {
    expect(parseCommand("Ajustar o volume para 35 em Notebook 2")).toEqual({
      intent: "set_volume",
      targetDeviceName: "Notebook 2",
      params: {
        volumePercent: 35
      }
    });
  });

  it("uses the last device separator for unquoted notify to reduce ambiguity", () => {
    expect(parseCommand("Avisar backup no servidor no Notebook 2")).toEqual({
      intent: "notify",
      targetDeviceName: "Notebook 2",
      params: {
        title: "Luna",
        message: "backup no servidor"
      }
    });
  });
});
