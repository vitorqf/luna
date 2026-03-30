import { createSocket } from "node:dgram";
import { createAgentDiscoveryAnnounceMessage } from "@luna/protocol";
import type { DeviceCapability } from "@luna/shared-types";

interface UdpSocket {
  send: (
    message: Buffer,
    port: number,
    address: string,
    callback?: (error: Error | null) => void
  ) => void;
  close: () => void;
}

interface DiscoveryAnnouncerDeps {
  createSocket: (type: "udp4") => UdpSocket;
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
}

export interface DiscoveryAnnouncerInput {
  serverUrl: string;
  device: {
    id: string;
    hostname: string;
    capabilities: DeviceCapability[];
  };
  intervalMs: number;
}

export interface DiscoveryAnnouncer {
  stop: () => void;
}

const defaultDeps: DiscoveryAnnouncerDeps = {
  createSocket: (type) => createSocket(type),
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval
};

const parseDiscoveryDestination = (
  serverUrl: string
): {
  host: string;
  port: number;
} => {
  const parsed = new URL(serverUrl);
  if (parsed.protocol !== "ws:" && parsed.protocol !== "wss:") {
    throw new Error("Discovery requires ws:// or wss:// server URL.");
  }

  const fallbackPort = parsed.protocol === "wss:" ? 443 : 80;
  const port = parsed.port ? Number.parseInt(parsed.port, 10) : fallbackPort;
  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("Discovery destination port is invalid.");
  }

  return {
    host: parsed.hostname,
    port
  };
};

export const createDiscoveryAnnouncer = (
  deps: DiscoveryAnnouncerDeps = defaultDeps
): ((input: DiscoveryAnnouncerInput) => DiscoveryAnnouncer) => {
  return (input: DiscoveryAnnouncerInput): DiscoveryAnnouncer => {
    const destination = parseDiscoveryDestination(input.serverUrl);
    const socket = deps.createSocket("udp4");

    const sendAnnouncement = () => {
      const serialized = JSON.stringify(
        createAgentDiscoveryAnnounceMessage({
          id: input.device.id,
          hostname: input.device.hostname,
          capabilities: [...input.device.capabilities]
        })
      );

      socket.send(
        Buffer.from(serialized, "utf-8"),
        destination.port,
        destination.host,
        () => undefined
      );
    };

    sendAnnouncement();

    const intervalHandle =
      input.intervalMs > 0
        ? deps.setIntervalFn(() => sendAnnouncement(), input.intervalMs)
        : undefined;

    let isStopped = false;

    return {
      stop: () => {
        if (isStopped) {
          return;
        }

        isStopped = true;

        if (intervalHandle) {
          deps.clearIntervalFn(intervalHandle);
        }

        socket.close();
      }
    };
  };
};
