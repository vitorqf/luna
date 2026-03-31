import { describe, expect, it } from "vitest";
import { evaluatePresenceTransition } from "../src/presence-state-machine";

describe("slice 42 - presence state machine", () => {
  it("moves missing to online on register", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "missing",
        event: "register"
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: true,
      ignoreEvent: false
    });
  });

  it("moves offline to online on register", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "offline",
        event: "register"
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: true,
      ignoreEvent: false
    });
  });

  it("keeps online on register without transition", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "register"
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: false,
      ignoreEvent: false
    });
  });

  it("moves online to offline on active socket_close", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "socket_close",
        isActiveSocket: true
      })
    ).toEqual({
      nextStatus: "offline",
      shouldTransition: true,
      ignoreEvent: false
    });
  });

  it("ignores stale socket_close event", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "socket_close",
        isActiveSocket: false
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: false,
      ignoreEvent: true
    });
  });

  it("moves online to offline on active heartbeat_timeout", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "heartbeat_timeout",
        isActiveSocket: true
      })
    ).toEqual({
      nextStatus: "offline",
      shouldTransition: true,
      ignoreEvent: false
    });
  });

  it("ignores stale heartbeat_timeout event", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "heartbeat_timeout",
        isActiveSocket: false
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: false,
      ignoreEvent: true
    });
  });

  it("keeps online on active heartbeat event", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "online",
        event: "heartbeat",
        isActiveSocket: true
      })
    ).toEqual({
      nextStatus: "online",
      shouldTransition: false,
      ignoreEvent: false
    });
  });

  it("ignores heartbeat while offline", () => {
    expect(
      evaluatePresenceTransition({
        currentStatus: "offline",
        event: "heartbeat",
        isActiveSocket: true
      })
    ).toEqual({
      nextStatus: "offline",
      shouldTransition: false,
      ignoreEvent: true
    });
  });
});
