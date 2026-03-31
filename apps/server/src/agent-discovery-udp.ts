import { parseAgentDiscoveryAnnounceMessage } from "@luna/protocol";
import { createSocket, type Socket } from "node:dgram";
import type {
  DeviceRepository,
  DiscoveredAgentRepository,
} from "./repositories/ports";
import { normalizeWhitespace } from "./utils/value";

export interface StartAgentDiscoveryUdpInput {
  host: string;
  port: number;
  deviceRepository: DeviceRepository;
  discoveredAgentRepository: DiscoveredAgentRepository;
}

export const startAgentDiscoveryUdp = async (
  input: StartAgentDiscoveryUdpInput,
): Promise<Socket> => {
  const discoverySocket = createSocket("udp4");
  discoverySocket.on("message", (messageBuffer) => {
    const announceMessage = parseAgentDiscoveryAnnounceMessage(
      messageBuffer.toString("utf-8"),
    );
    if (!announceMessage) {
      return;
    }

    const discoveredAgentId = normalizeWhitespace(announceMessage.payload.id);
    if (input.deviceRepository.has(discoveredAgentId)) {
      input.discoveredAgentRepository.removeById(discoveredAgentId);
      return;
    }

    input.discoveredAgentRepository.upsert({
      id: discoveredAgentId,
      hostname: normalizeWhitespace(announceMessage.payload.hostname),
      capabilities: [...announceMessage.payload.capabilities],
    });
  });

  await new Promise<void>((resolve, reject) => {
    const handleListening = () => {
      discoverySocket.off("error", handleError);
      resolve();
    };

    const handleError = (error: Error) => {
      discoverySocket.off("listening", handleListening);
      reject(error);
    };

    discoverySocket.once("listening", handleListening);
    discoverySocket.once("error", handleError);
    discoverySocket.bind(input.port, input.host);
  });

  return discoverySocket;
};

export const stopAgentDiscoveryUdp = async (
  discoverySocket: Socket | undefined,
): Promise<void> => {
  if (!discoverySocket) {
    return;
  }

  await new Promise<void>((resolve) => {
    discoverySocket.close(() => resolve());
  });
};
