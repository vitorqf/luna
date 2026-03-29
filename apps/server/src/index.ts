import type { Device } from "@luna/shared-types";
import { parseAgentRegisterMessage } from "@luna/protocol";
import {
  createServer,
  type IncomingMessage,
  type Server as HttpServer,
  type ServerResponse
} from "node:http";
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
  let httpServer: HttpServer | undefined;
  let webSocketServer: WebSocketServer | undefined;

  const getRegisteredDevices = (): Device[] => Array.from(devices.values());

  const handleRequest = (_request: IncomingMessage, response: ServerResponse): void => {
    if (_request.method === "GET" && _request.url === "/devices") {
      response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify(getRegisteredDevices()));
      return;
    }

    response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Not Found" }));
  };

  const start = async (): Promise<void> => {
    if (httpServer || webSocketServer) {
      return;
    }

    httpServer = createServer(handleRequest);
    webSocketServer = new WebSocketServer({ server: httpServer });

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
      if (!httpServer) {
        reject(new Error("HTTP server is not initialized."));
        return;
      }

      const handleListening = () => {
        httpServer?.off("error", handleError);
        resolve();
      };

      const handleError = (error: Error) => {
        httpServer?.off("listening", handleListening);
        reject(error);
      };

      httpServer.once("listening", handleListening);
      httpServer.once("error", handleError);
      httpServer.listen(port, host);
    });

    const address = httpServer.address();
    if (!address || typeof address === "string") {
      throw new Error("HTTP server did not expose a TCP address.");
    }

    port = (address as AddressInfo).port;
  };

  const stop = async (): Promise<void> => {
    if (!httpServer || !webSocketServer) {
      return;
    }

    const currentHttpServer = httpServer;
    const currentWebSocketServer = webSocketServer;
    httpServer = undefined;
    webSocketServer = undefined;

    await new Promise<void>((resolve, reject) => {
      currentWebSocketServer.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await new Promise<void>((resolve, reject) => {
      currentHttpServer.close((error) => {
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
    getRegisteredDevices
  };
};
