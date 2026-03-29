import {
  COMMAND_ACK_STATUS_ACKNOWLEDGED,
  createAgentRegisterMessage,
  createCommandAckMessage,
  parseCommandDispatchMessage
} from "@luna/protocol";
import { WebSocket } from "ws";

export const agentBootstrapReady = true;

export interface AgentIdentity {
  id: string;
  name: string;
  hostname: string;
}

export interface ConnectAgentInput {
  serverUrl: string;
  device: AgentIdentity;
  onCommand?: (command: ReceivedCommand) => void | Promise<void>;
  executeNotify?: (
    notification: LocalNotification
  ) => void | Promise<void>;
}

export interface AgentConnection {
  disconnect: () => Promise<void>;
}

export interface ReceivedCommand {
  commandId: string;
  intent: string;
  params: Record<string, unknown>;
}

export interface LocalNotification {
  title: string;
  message: string;
}

const NOTIFY_INTENT = "notify" as const;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const extractLocalNotification = (
  params: Record<string, unknown>
): LocalNotification | null => {
  const title = params.title;
  const message = params.message;

  if (!isNonEmptyString(title) || !isNonEmptyString(message)) {
    return null;
  }

  return { title, message };
};

const executeLocalNotify = async (
  notification: LocalNotification
): Promise<void> => {
  console.info(`[luna][notify] ${notification.title}: ${notification.message}`);
};

export const connectAgent = async (
  input: ConnectAgentInput
): Promise<AgentConnection> => {
  const socket = new WebSocket(input.serverUrl);
  const executeNotify = input.executeNotify ?? executeLocalNotify;

  const sendSerializedMessage = async (
    serializedMessage: string
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

  await new Promise<void>((resolve, reject) => {
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

  socket.on("message", (rawMessage) => {
    const dispatchMessage = parseCommandDispatchMessage(rawMessage.toString());
    if (!dispatchMessage) {
      return;
    }

    void (async () => {
      try {
        if (dispatchMessage.payload.intent === NOTIFY_INTENT) {
          const notification = extractLocalNotification(
            dispatchMessage.payload.params
          );
          if (notification) {
            await executeNotify(notification);
          }
        }

        await input.onCommand?.({
          commandId: dispatchMessage.payload.commandId,
          intent: dispatchMessage.payload.intent,
          params: dispatchMessage.payload.params
        });
      } finally {
        if (socket.readyState !== WebSocket.OPEN) {
          return;
        }

        await sendSerializedMessage(
          JSON.stringify(
            createCommandAckMessage({
              commandId: dispatchMessage.payload.commandId,
              status: COMMAND_ACK_STATUS_ACKNOWLEDGED
            })
          )
        );
      }
    })().catch(() => undefined);
  });

  await sendSerializedMessage(
    JSON.stringify(createAgentRegisterMessage(input.device))
  );

  return {
    disconnect: async () => {
      if (socket.readyState === WebSocket.CLOSED) {
        return;
      }

      await new Promise<void>((resolve) => {
        socket.once("close", () => resolve());
        socket.close();
      });
    }
  };
};
