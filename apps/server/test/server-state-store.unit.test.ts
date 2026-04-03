import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  loadPersistedServerState,
  savePersistedServerState,
} from "../src/server-state-store";

describe("slice 37 - server state store", () => {
  it("loads empty state when the file does not exist", () => {
    const state = loadPersistedServerState(
      join(tmpdir(), "missing-luna-state", "server-state.json"),
    );

    expect(state).toEqual({
      devices: [],
      customDeviceAliases: {},
      commandHistory: [],
    });
  });

  it("fails when the state file contains invalid json", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");

    try {
      await writeFile(stateFile, "{not-json", "utf-8");

      expect(() => loadPersistedServerState(stateFile)).toThrowError(
        "Server state file is not valid JSON.",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when the state file contains an invalid snapshot schema", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");

    try {
      await writeFile(
        stateFile,
        JSON.stringify({
          version: 1,
          devices: [],
          customDeviceAliases: [],
          commandHistory: [],
        }),
        "utf-8",
      );

      expect(() => loadPersistedServerState(stateFile)).toThrowError(
        "Server state file has an invalid schema.",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when a persisted device status is outside the canonical shared catalog", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");

    try {
      await writeFile(
        stateFile,
        JSON.stringify({
          version: 1,
          devices: [
            {
              id: "notebook-2",
              name: "Notebook 2",
              hostname: "notebook-2.local",
              status: "pending",
              capabilities: ["notify"],
            },
          ],
          customDeviceAliases: {},
          commandHistory: [],
        }),
        "utf-8",
      );

      expect(() => loadPersistedServerState(stateFile)).toThrowError(
        "Server state file has an invalid schema.",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("fails when a persisted command reason is outside the canonical shared catalog", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateFile = join(tempDir, "server-state.json");

    try {
      await writeFile(
        stateFile,
        JSON.stringify({
          version: 1,
          devices: [],
          customDeviceAliases: {},
          commandHistory: [
            {
              id: "command-1",
              rawText: "Abrir Spotify no Notebook 2",
              intent: "open_app",
              targetDeviceId: "notebook-2",
              params: {
                appName: "Spotify",
              },
              status: "failed",
              reason: "timeout",
            },
          ],
        }),
        "utf-8",
      );

      expect(() => loadPersistedServerState(stateFile)).toThrowError(
        "Server state file has an invalid schema.",
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("writes the snapshot atomically and creates the parent directory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "luna-server-state-"));
    const stateDir = join(tempDir, "nested", "state");
    const stateFile = join(stateDir, "server-state.json");

    try {
      savePersistedServerState(stateFile, {
        devices: [
          {
            id: "notebook-2",
            name: "Sala",
            hostname: "notebook-2.local",
            status: "offline",
            capabilities: ["notify"],
          },
        ],
        customDeviceAliases: {
          "notebook-2": "Sala",
        },
        commandHistory: [
          {
            id: "command-1",
            rawText: "Notificar Sala",
            intent: "notify",
            targetDeviceId: "notebook-2",
            params: {
              title: "Luna",
              message: "Slice 37",
            },
            status: "success",
          },
        ],
      });

      await expect(readFile(stateFile, "utf-8")).resolves.toBe(
        JSON.stringify(
          {
            version: 1,
            devices: [
              {
                id: "notebook-2",
                name: "Sala",
                hostname: "notebook-2.local",
                status: "offline",
                capabilities: ["notify"],
              },
            ],
            customDeviceAliases: {
              "notebook-2": "Sala",
            },
            commandHistory: [
              {
                id: "command-1",
                rawText: "Notificar Sala",
                intent: "notify",
                targetDeviceId: "notebook-2",
                params: {
                  title: "Luna",
                  message: "Slice 37",
                },
                status: "success",
              },
            ],
          },
          null,
          2,
        ),
      );
      await expect(readdir(stateDir)).resolves.toEqual(["server-state.json"]);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });
});
