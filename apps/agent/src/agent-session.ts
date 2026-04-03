import {
  createAgentRegisterMessage,
  createCommandAckMessage,
  parseCommandDispatchMessage,
  type CommandAckPayload,
} from "@luna/protocol";
import type { DeviceCapability } from "@luna/shared-types";
import { WebSocket } from "ws";
import {
  dispatchIntentExecution,
  type DispatchIntentExecutionInput,
  type IntentDispatcherExecutors,
} from "./intent-dispatcher";

type MessageLike = {
  toString: (encoding?: string) => string;
};

export interface AgentSessionSocket {
  readonly readyState: number;
  send: (message: string, callback: (error?: Error) => void) => void;
  close: () => void;
  once: {
    (event: "open", listener: () => void): AgentSessionSocket;
    (event: "error", listener: (error: Error) => void): AgentSessionSocket;
    (event: "close", listener: () => void): AgentSessionSocket;
  };
  on: {
    (event: "message", listener: (message: MessageLike) => void): AgentSessionSocket;
    (event: "close", listener: () => void): AgentSessionSocket;
  };
  off: {
    (event: "open", listener: () => void): AgentSessionSocket;
    (event: "error", listener: (error: Error) => void): AgentSessionSocket;
  };
}

export interface AgentSessionCommand {
  commandId: string;
  intent: string;
  params: Record<string, unknown>;
}

export interface AgentSessionInput {
  serverUrl: string;
  device: {
    id: string;
    name: string;
    hostname: string;
    capabilities: DeviceCapability[];
  };
  executors: IntentDispatcherExecutors;
  onCommand?: ((command: AgentSessionCommand) => void | Promise<void>) | undefined;
}

export interface AgentSession {
  isOpen: () => boolean;
  sendSerializedMessage: (message: string) => Promise<void>;
  disconnect: () => Promise<void>;
  onClose: (handler: () => void) => void;
}

interface AgentSessionDeps {
  createSocket: (serverUrl: string) => AgentSessionSocket;
  dispatchIntentExecution: (
    input: DispatchIntentExecutionInput,
  ) => Promise<CommandAckPayload>;
}

const defaultDeps: AgentSessionDeps = {
  createSocket: (serverUrl) => new WebSocket(serverUrl) as unknown as AgentSessionSocket,
  dispatchIntentExecution,
};

const sendSerializedMessage = async (
  socket: AgentSessionSocket,
  serializedMessage: string,
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    socket.send(serializedMessage, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const waitForSocketOpen = async (socket: AgentSessionSocket): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    const handleOpen = () => {
      socket.off("error", handleError);
      resolve();
    };

    const handleError = (error: Error) => {
      socket.off("open", handleOpen);
      reject(error);
    };

    socket.once("open", handleOpen);
    socket.once("error", handleError);
  });

export const createAgentSession = async (
  input: AgentSessionInput,
  deps: AgentSessionDeps = defaultDeps,
): Promise<AgentSession> => {
  const socket = deps.createSocket(input.serverUrl);

  await waitForSocketOpen(socket);

  socket.on("message", (rawMessage) => {
    const dispatchMessage = parseCommandDispatchMessage(rawMessage.toString());
    if (!dispatchMessage) {
      return;
    }

    void (async () => {
      const command = {
        commandId: dispatchMessage.payload.commandId,
        intent: dispatchMessage.payload.intent,
        params: dispatchMessage.payload.params,
      };
      const commandAckPayload = await deps.dispatchIntentExecution({
        ...command,
        executors: input.executors,
      });

      try {
        await input.onCommand?.(command);
      } finally {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        await sendSerializedMessage(
          socket,
          JSON.stringify(createCommandAckMessage(commandAckPayload)),
        );
      }
    })().catch(() => undefined);
  });

  await sendSerializedMessage(
    socket,
    JSON.stringify(
      createAgentRegisterMessage({
        id: input.device.id,
        name: input.device.name,
        hostname: input.device.hostname,
        capabilities: [...input.device.capabilities],
      }),
    ),
  );

  return {
    isOpen: () => socket.readyState === WebSocket.OPEN,
    sendSerializedMessage: (message) => sendSerializedMessage(socket, message),
    disconnect: async () => {
      if (socket.readyState === WebSocket.CLOSED) {
        return;
      }

      await new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    },
    onClose: (handler) => {
      socket.on("close", handler);
    },
  };
};
