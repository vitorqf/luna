import type { Device } from "@luna/shared-types";
import { parseAgentRegisterMessage } from "@luna/protocol";
import type { AddressInfo } from "node:net";
import { WebSocketServer } from "ws";

export const serverBootstrapReady = true;

export interface LunaServerOptions {
  host?: string;
  port?: number;
}

export interface LunaServer {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  getPort: () => number;
  getRegisteredDevices: () => Device[];
}

export const createLunaServer = (options: LunaServerOptions = {}): LunaServer => {
  const devices = new Map<string, Device>();
  const host = options.host ?? "127.0.0.1";
  let port = options.port ?? 0;
  let webSocketServer: WebSocketServer | undefined;

  const start = async (): Promise<void> => {
    if (webSocketServer) {
      return;
    }

    webSocketServer = new WebSocketServer({ host, port });
    webSocketServer.on("connection", (socket) => {
      socket.on("message", (rawMessage) => {
        const registerMessage = parseAgentRegisterMessage(rawMessage.toString());
        if (!registerMessage) {
          return;
        }

        devices.set(registerMessage.payload.id, {
          ...registerMessage.payload,
          status: "online"
        });
      });
    });

    await new Promise<void>((resolve, reject) => {
      if (!webSocketServer) {
        reject(new Error("WebSocket server is not initialized."));
        return;
      }

      const handleListening = () => {
        webSocketServer?.off("error", handleError);
        resolve();
      };

      const handleError = (error: Error) => {
        webSocketServer?.off("listening", handleListening);
        reject(error);
      };

      webSocketServer.once("listening", handleListening);
      webSocketServer.once("error", handleError);
    });

    const address = webSocketServer.address();
    if (!address || typeof address === "string") {
      throw new Error("WebSocket server did not expose a TCP address.");
    }

    port = (address as AddressInfo).port;
  };

  const stop = async (): Promise<void> => {
    if (!webSocketServer) {
      return;
    }

    const currentServer = webSocketServer;
    webSocketServer = undefined;

    await new Promise<void>((resolve, reject) => {
      currentServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  };

  return {
    start,
    stop,
    getPort: () => port,
    getRegisteredDevices: () => Array.from(devices.values())
  };
};
