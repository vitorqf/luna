import { EventEmitter } from "node:events";
import {
  createAgentRegisterMessage,
  createCommandAckMessage,
  createCommandDispatchMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import {
  createAgentSession,
  type AgentSessionSocket,
} from "../src/agent-session";

class FakeSocket extends EventEmitter implements AgentSessionSocket {
  readyState: number = WebSocket.CONNECTING;
  readonly sentMessages: string[] = [];

  send = vi.fn((message: string, callback: (error?: Error) => void) => {
    this.sentMessages.push(message);
    callback();
  });

  close = vi.fn(() => {
    if (this.readyState === WebSocket.CLOSED) {
      return;
    }

    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  });

  emitOpen(): void {
    this.readyState = WebSocket.OPEN;
    this.emit("open");
  }

  emitMessage(message: string): void {
    this.emit("message", Buffer.from(message, "utf-8"));
  }

  emitSocketClose(): void {
    this.readyState = WebSocket.CLOSED;
    this.emit("close");
  }
}

const createExecutors = () => ({
  executeNotify: vi.fn(async () => undefined),
  executeOpenApp: vi.fn(async () => undefined),
  executeSetVolume: vi.fn(async () => undefined),
  executePlayMedia: vi.fn(async () => undefined),
});

const flushAsyncWork = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
};

describe("agent session", () => {
  it("sends agent.register once after the socket opens", async () => {
    const socket = new FakeSocket();
    const createSocket = vi.fn(() => socket);

    const sessionPromise = createAgentSession(
      {
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify", "open_app"],
        },
        executors: createExecutors(),
      },
      {
        createSocket,
        dispatchIntentExecution: vi.fn(),
      },
    );

    expect(socket.sentMessages).toEqual([]);

    socket.emitOpen();
    const session = await sessionPromise;

    expect(createSocket).toHaveBeenCalledWith("ws://127.0.0.1:4000");
    expect(socket.sentMessages).toEqual([
      JSON.stringify(
        createAgentRegisterMessage({
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify", "open_app"],
        }),
      ),
    ]);
    expect(session.isOpen()).toBe(true);
  });

  it("ignores invalid inbound messages", async () => {
    const socket = new FakeSocket();
    const dispatchIntentExecution = vi.fn();

    const sessionPromise = createAgentSession(
      {
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        executors: createExecutors(),
      },
      {
        createSocket: () => socket,
        dispatchIntentExecution,
      },
    );

    socket.emitOpen();
    await sessionPromise;

    socket.emitMessage("{not-json");
    await flushAsyncWork();

    expect(dispatchIntentExecution).not.toHaveBeenCalled();
    expect(socket.sentMessages).toHaveLength(1);
  });

  it("dispatches a valid command and sends the resulting ack", async () => {
    const socket = new FakeSocket();
    const executors = createExecutors();
    const dispatchIntentExecution = vi.fn(async () => ({
      commandId: "command-1",
      status: "success" as const,
    }));

    const sessionPromise = createAgentSession(
      {
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        executors,
      },
      {
        createSocket: () => socket,
        dispatchIntentExecution,
      },
    );

    socket.emitOpen();
    await sessionPromise;

    socket.emitMessage(
      JSON.stringify(
        createCommandDispatchMessage({
          commandId: "command-1",
          intent: "notify",
          params: {
            title: "Luna",
            message: "Slice 55",
          },
        }),
      ),
    );
    await flushAsyncWork();

    expect(dispatchIntentExecution).toHaveBeenCalledWith({
      commandId: "command-1",
      intent: "notify",
      params: {
        title: "Luna",
        message: "Slice 55",
      },
      executors,
    });
    expect(socket.sentMessages[1]).toBe(
      JSON.stringify(
        createCommandAckMessage({
          commandId: "command-1",
          status: "success",
        }),
      ),
    );
  });

  it("keeps ack flow when onCommand throws", async () => {
    const socket = new FakeSocket();
    const onCommand = vi.fn(async () => {
      throw new Error("onCommand failure");
    });

    const sessionPromise = createAgentSession(
      {
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        executors: createExecutors(),
        onCommand,
      },
      {
        createSocket: () => socket,
        dispatchIntentExecution: vi.fn(async () => ({
          commandId: "command-2",
          status: "failed" as const,
          reason: "execution_error" as const,
        })),
      },
    );

    socket.emitOpen();
    await sessionPromise;

    socket.emitMessage(
      JSON.stringify(
        createCommandDispatchMessage({
          commandId: "command-2",
          intent: "notify",
          params: {
            title: "Luna",
            message: "Slice 55",
          },
        }),
      ),
    );
    await flushAsyncWork();

    expect(onCommand).toHaveBeenCalledWith({
      commandId: "command-2",
      intent: "notify",
      params: {
        title: "Luna",
        message: "Slice 55",
      },
    });
    expect(socket.sentMessages[1]).toBe(
      JSON.stringify(
        createCommandAckMessage({
          commandId: "command-2",
          status: "failed",
          reason: "execution_error",
        }),
      ),
    );
  });

  it("does not send ack when the socket closes before command execution finishes", async () => {
    const socket = new FakeSocket();
    let resolveAck:
      | ((payload: Extract<CommandAckPayload, { status: "success" }>) => void)
      | undefined;
    const dispatchIntentExecution = vi.fn(
      (): Promise<CommandAckPayload> =>
        new Promise((resolve) => {
          resolveAck = resolve;
        }),
    );

    const sessionPromise = createAgentSession(
      {
        serverUrl: "ws://127.0.0.1:4000",
        device: {
          id: "notebook-2",
          name: "Notebook 2",
          hostname: "notebook-2.local",
          capabilities: ["notify"],
        },
        executors: createExecutors(),
      },
      {
        createSocket: () => socket,
        dispatchIntentExecution,
      },
    );

    socket.emitOpen();
    await sessionPromise;

    socket.emitMessage(
      JSON.stringify(
        createCommandDispatchMessage({
          commandId: "command-3",
          intent: "notify",
          params: {
            title: "Luna",
            message: "Slice 55",
          },
        }),
      ),
    );

    socket.emitSocketClose();
    resolveAck?.({
      commandId: "command-3",
      status: "success",
    });
    await flushAsyncWork();

    expect(socket.sentMessages).toHaveLength(1);
  });
});
