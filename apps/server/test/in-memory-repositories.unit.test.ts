import type { Command, Device, DiscoveredAgent } from "@luna/shared-types";
import { describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import {
  createInMemoryCommandHistoryRepository,
  createInMemoryConnectionRepository,
  createInMemoryDeviceAliasRepository,
  createInMemoryDeviceRepository,
  createInMemoryDiscoveredAgentRepository,
  createInMemoryPendingAckRepository,
} from "../src/repositories/in-memory";

describe("slice 43 - in-memory repositories", () => {
  it("handles device repository CRUD operations", () => {
    const repository = createInMemoryDeviceRepository();
    const device: Device = {
      id: "notebook-2",
      name: "Notebook 2",
      hostname: "notebook-2.local",
      status: "online",
      capabilities: ["notify"],
    };

    expect(repository.list()).toEqual([]);
    expect(repository.has("notebook-2")).toBe(false);
    expect(repository.getById("notebook-2")).toBeUndefined();

    repository.save(device);

    expect(repository.has("notebook-2")).toBe(true);
    expect(repository.getById("notebook-2")).toEqual(device);
    expect(repository.list()).toEqual([device]);

    repository.clear();
    expect(repository.list()).toEqual([]);
  });

  it("handles discovered agent repository operations", () => {
    const repository = createInMemoryDiscoveredAgentRepository();
    const discoveredAgent: DiscoveredAgent = {
      id: "mini-pc-1",
      hostname: "mini-pc-1.local",
      capabilities: ["notify"],
    };

    repository.upsert(discoveredAgent);
    expect(repository.getById("mini-pc-1")).toEqual(discoveredAgent);
    expect(repository.list()).toEqual([discoveredAgent]);

    repository.removeById("mini-pc-1");
    expect(repository.getById("mini-pc-1")).toBeUndefined();
    expect(repository.list()).toEqual([]);
  });

  it("handles alias repository with record load/export", () => {
    const repository = createInMemoryDeviceAliasRepository();

    repository.set("notebook-2", "Sala");
    expect(repository.getById("notebook-2")).toBe("Sala");
    expect(repository.toRecord()).toEqual({
      "notebook-2": "Sala",
    });

    repository.clear();
    expect(repository.toRecord()).toEqual({});

    repository.loadFromRecord({
      "notebook-2": "Sala",
      "mini-pc-1": "Estudio",
    });
    expect(repository.getById("notebook-2")).toBe("Sala");
    expect(repository.getById("mini-pc-1")).toBe("Estudio");
  });

  it("handles command history repository append/list/replace", () => {
    const repository = createInMemoryCommandHistoryRepository();
    const firstCommand: Command = {
      id: "command-1",
      rawText: "Notificar no Notebook 2",
      intent: "notify",
      targetDeviceId: "notebook-2",
      params: {
        title: "Luna",
        message: "Oi",
      },
      status: "success",
    };
    const secondCommand: Command = {
      id: "command-2",
      rawText: "Abrir Spotify no Notebook 2",
      intent: "open_app",
      targetDeviceId: "notebook-2",
      params: {
        appName: "Spotify",
      },
      status: "failed",
      reason: "execution_error",
    };

    repository.append(firstCommand);
    expect(repository.list()).toEqual([firstCommand]);

    repository.replaceAll([secondCommand]);
    expect(repository.list()).toEqual([secondCommand]);

    repository.clear();
    expect(repository.list()).toEqual([]);
  });

  it("handles connection repository bind/lookups and active unbind semantics", () => {
    const repository = createInMemoryConnectionRepository();
    const activeSocket = {} as WebSocket;
    const staleSocket = {} as WebSocket;

    repository.bind("notebook-2", staleSocket);
    expect(repository.getSocketByDeviceId("notebook-2")).toBe(staleSocket);
    expect(repository.getDeviceIdBySocket(staleSocket)).toBe("notebook-2");

    repository.bind("notebook-2", activeSocket);
    expect(repository.getSocketByDeviceId("notebook-2")).toBe(activeSocket);
    expect(repository.getDeviceIdBySocket(activeSocket)).toBe("notebook-2");

    expect(repository.unbindIfActive("notebook-2", staleSocket)).toBe(false);
    expect(repository.getSocketByDeviceId("notebook-2")).toBe(activeSocket);

    expect(repository.unbindIfActive("notebook-2", activeSocket)).toBe(true);
    expect(repository.getSocketByDeviceId("notebook-2")).toBeUndefined();
  });

  it("handles pending ack repository set/get/delete/entries", () => {
    const repository = createInMemoryPendingAckRepository<{
      commandId: string;
    }>();

    repository.set("command-1", {
      commandId: "command-1",
    });
    repository.set("command-2", {
      commandId: "command-2",
    });

    expect(repository.get("command-1")).toEqual({
      commandId: "command-1",
    });
    expect(Array.from(repository.entries())).toEqual([
      ["command-1", { commandId: "command-1" }],
      ["command-2", { commandId: "command-2" }],
    ]);

    repository.delete("command-1");
    expect(repository.get("command-1")).toBeUndefined();
  });
});
