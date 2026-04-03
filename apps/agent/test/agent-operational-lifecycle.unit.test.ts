import { createAgentHeartbeatMessage } from "@luna/protocol";
import { describe, expect, it, vi } from "vitest";
import {
  createAgentOperationalLifecycle,
  type AgentOperationalLifecycleTimer,
} from "../src/agent-operational-lifecycle";
import type { AgentSession } from "../src/agent-session";

const createSession = (): AgentSession => ({
  isOpen: vi.fn(() => true),
  sendSerializedMessage: vi.fn(async () => undefined),
  disconnect: vi.fn(async () => undefined),
  onClose: vi.fn(),
});

describe("agent operational lifecycle", () => {
  it("starts discovery announcer and heartbeat when configured", async () => {
    const session = createSession();
    let heartbeatCallback: (() => void) | undefined;
    const stopDiscovery = vi.fn(() => undefined);
    const startDiscoveryAnnouncer = vi.fn(() => ({
      stop: stopDiscovery,
    }));

    createAgentOperationalLifecycle(
      {
        session,
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify", "open_app"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 10_000,
      },
      {
        setIntervalFn: ((callback: () => void) => {
          heartbeatCallback = callback;
          return 123 as unknown as AgentOperationalLifecycleTimer;
        }) as typeof setInterval,
        clearIntervalFn: vi.fn(),
        startDiscoveryAnnouncer,
        logDiscoveryStartError: vi.fn(),
      },
    );

    expect(startDiscoveryAnnouncer).toHaveBeenCalledWith({
      serverUrl: "ws://127.0.0.1:4000",
      device: {
        id: "notebook-2",
        hostname: "notebook-2.local",
        capabilities: ["notify", "open_app"],
      },
      intervalMs: 10_000,
    });
    expect(heartbeatCallback).toBeTypeOf("function");
  });

  it("sends heartbeat payload on interval only while the session is open", async () => {
    let isOpen = true;
    let heartbeatCallback: (() => void) | undefined;
    const sendSerializedMessage = vi.fn(async () => undefined);
    const session: AgentSession = {
      isOpen: vi.fn(() => isOpen),
      sendSerializedMessage,
      disconnect: vi.fn(async () => undefined),
      onClose: vi.fn(),
    };

    createAgentOperationalLifecycle(
      {
        session,
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 0,
      },
      {
        setIntervalFn: ((callback: () => void) => {
          heartbeatCallback = callback;
          return 123 as unknown as AgentOperationalLifecycleTimer;
        }) as typeof setInterval,
        clearIntervalFn: vi.fn(),
        startDiscoveryAnnouncer: vi.fn(),
        logDiscoveryStartError: vi.fn(),
      },
    );

    await heartbeatCallback?.();
    isOpen = false;
    await heartbeatCallback?.();

    expect(sendSerializedMessage).toHaveBeenCalledTimes(1);
    expect(sendSerializedMessage).toHaveBeenCalledWith(
      JSON.stringify(createAgentHeartbeatMessage({})),
    );
  });

  it("ignores rejected heartbeat sends", async () => {
    let heartbeatCallback: (() => void) | undefined;
    const sendSerializedMessage = vi.fn(async () => {
      throw new Error("send failed");
    });

    createAgentOperationalLifecycle(
      {
        session: {
          isOpen: vi.fn(() => true),
          sendSerializedMessage,
          disconnect: vi.fn(async () => undefined),
          onClose: vi.fn(),
        },
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 0,
      },
      {
        setIntervalFn: ((callback: () => void) => {
          heartbeatCallback = callback;
          return 123 as unknown as AgentOperationalLifecycleTimer;
        }) as typeof setInterval,
        clearIntervalFn: vi.fn(),
        startDiscoveryAnnouncer: vi.fn(),
        logDiscoveryStartError: vi.fn(),
      },
    );

    expect(() => heartbeatCallback?.()).not.toThrow();
    expect(sendSerializedMessage).toHaveBeenCalledTimes(1);
  });

  it("stops heartbeat and discovery when the session closes", async () => {
    const session = createSession();
    const clearIntervalFn = vi.fn();
    const stopDiscovery = vi.fn(() => undefined);
    let closeHandler: (() => void) | undefined;

    vi.mocked(session.onClose).mockImplementation((handler) => {
      closeHandler = handler;
    });

    createAgentOperationalLifecycle(
      {
        session,
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 10_000,
      },
      {
        setIntervalFn: (() =>
          123 as unknown as AgentOperationalLifecycleTimer) as unknown as typeof setInterval,
        clearIntervalFn,
        startDiscoveryAnnouncer: vi.fn(() => ({
          stop: stopDiscovery,
        })),
        logDiscoveryStartError: vi.fn(),
      },
    );

    closeHandler?.();

    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(stopDiscovery).toHaveBeenCalledTimes(1);
  });

  it("disconnect stops local resources immediately and then awaits session disconnect", async () => {
    const stopDiscovery = vi.fn(() => undefined);
    let resolveDisconnect: (() => void) | undefined;
    const disconnect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveDisconnect = resolve;
        }),
    );

    const lifecycle = createAgentOperationalLifecycle(
      {
        session: {
          isOpen: vi.fn(() => true),
          sendSerializedMessage: vi.fn(async () => undefined),
          disconnect,
          onClose: vi.fn(),
        },
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 10_000,
      },
      {
        setIntervalFn: (() =>
          123 as unknown as AgentOperationalLifecycleTimer) as unknown as typeof setInterval,
        clearIntervalFn: vi.fn(),
        startDiscoveryAnnouncer: vi.fn(() => ({
          stop: stopDiscovery,
        })),
        logDiscoveryStartError: vi.fn(),
      },
    );

    const disconnectPromise = lifecycle.disconnect();

    expect(stopDiscovery).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);

    resolveDisconnect?.();
    await disconnectPromise;
  });

  it("keeps cleanup idempotent across close and disconnect", async () => {
    const clearIntervalFn = vi.fn();
    const stopDiscovery = vi.fn(() => undefined);
    let closeHandler: (() => void) | undefined;
    const session = createSession();

    vi.mocked(session.onClose).mockImplementation((handler) => {
      closeHandler = handler;
    });

    const lifecycle = createAgentOperationalLifecycle(
      {
        session,
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 5_000,
        discoveryIntervalMs: 10_000,
      },
      {
        setIntervalFn: (() =>
          123 as unknown as AgentOperationalLifecycleTimer) as unknown as typeof setInterval,
        clearIntervalFn,
        startDiscoveryAnnouncer: vi.fn(() => ({
          stop: stopDiscovery,
        })),
        logDiscoveryStartError: vi.fn(),
      },
    );

    closeHandler?.();
    await lifecycle.disconnect();
    closeHandler?.();

    expect(clearIntervalFn).toHaveBeenCalledTimes(1);
    expect(stopDiscovery).toHaveBeenCalledTimes(1);
  });

  it("fires onDisconnect once on close, including programmatic disconnect", async () => {
    let closeHandler: (() => void) | undefined;
    const onDisconnect = vi.fn(() => undefined);
    const disconnect = vi.fn(async () => {
      closeHandler?.();
    });
    const session = createSession();

    vi.mocked(session.onClose).mockImplementation((handler) => {
      closeHandler = handler;
    });
    vi.mocked(session.disconnect).mockImplementation(disconnect);

    const lifecycle = createAgentOperationalLifecycle(
      {
        session,
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        heartbeatIntervalMs: 0,
        discoveryIntervalMs: 0,
        onDisconnect,
      },
      {
        setIntervalFn: setInterval,
        clearIntervalFn: clearInterval,
        startDiscoveryAnnouncer: vi.fn(),
        logDiscoveryStartError: vi.fn(),
      },
    );

    await lifecycle.disconnect();
    closeHandler?.();

    expect(onDisconnect).toHaveBeenCalledTimes(1);
  });

  it("logs discovery startup failures and does not throw", () => {
    const logDiscoveryStartError = vi.fn();

    expect(() =>
      createAgentOperationalLifecycle(
        {
          session: createSession(),
          serverUrl: "ws://127.0.0.1:4000",
          device: {
            id: "notebook-2",
            hostname: "notebook-2.local",
            capabilities: ["notify"],
          },
          heartbeatIntervalMs: 0,
          discoveryIntervalMs: 5_000,
        },
        {
          setIntervalFn: setInterval,
          clearIntervalFn: clearInterval,
          startDiscoveryAnnouncer: vi.fn(() => {
            throw new Error("discovery failed");
          }),
          logDiscoveryStartError,
        },
      ),
    ).not.toThrow();

    expect(logDiscoveryStartError).toHaveBeenCalledWith({
      deviceId: "notebook-2",
      error: new Error("discovery failed"),
    });
  });
});
