import type { Device } from "@luna/shared-types";
import type { WebSocket } from "ws";

export interface CreatePresenceServiceInput {
  devices: Map<string, Device>;
  deviceSockets: Map<string, WebSocket>;
  heartbeatTimeoutMs: number;
  onDeviceOffline?: (() => void) | undefined;
}

export class PresenceService {
  private readonly heartbeatTimeouts = new Map<string, NodeJS.Timeout>();

  public constructor(private readonly input: CreatePresenceServiceInput) {}

  public readonly clearHeartbeatTimeout = (deviceId: string): void => {
    const timeoutHandle = this.heartbeatTimeouts.get(deviceId);
    if (!timeoutHandle) {
      return;
    }

    clearTimeout(timeoutHandle);
    this.heartbeatTimeouts.delete(deviceId);
  };

  public readonly markDeviceOffline = (deviceId: string): void => {
    const device = this.input.devices.get(deviceId);
    if (!device) {
      return;
    }

    if (device.status === "offline") {
      return;
    }

    this.input.devices.set(deviceId, {
      ...device,
      status: "offline",
    });
    this.input.onDeviceOffline?.();
  };

  public readonly armHeartbeatTimeout = (
    deviceId: string,
    socket: WebSocket,
  ): void => {
    this.clearHeartbeatTimeout(deviceId);

    const timeoutHandle = setTimeout(() => {
      this.heartbeatTimeouts.delete(deviceId);
      if (this.input.deviceSockets.get(deviceId) !== socket) {
        return;
      }

      this.input.deviceSockets.delete(deviceId);
      this.markDeviceOffline(deviceId);
      socket.terminate();
    }, this.input.heartbeatTimeoutMs);

    this.heartbeatTimeouts.set(deviceId, timeoutHandle);
  };

  public readonly clearAllHeartbeatTimeouts = (): void => {
    for (const timeoutHandle of this.heartbeatTimeouts.values()) {
      clearTimeout(timeoutHandle);
    }
    this.heartbeatTimeouts.clear();
  };
}
