import type { Device } from "@luna/shared-types";
import type { WebSocket } from "ws";
import { evaluatePresenceTransition } from "./presence-state-machine";

export interface CreatePresenceServiceInput {
  devices: Map<string, Device>;
  deviceSockets: Map<string, WebSocket>;
  heartbeatTimeoutMs: number;
  onDeviceOffline?: (() => void) | undefined;
}

export class PresenceService {
  private readonly heartbeatTimeouts = new Map<string, NodeJS.Timeout>();

  public constructor(private readonly input: CreatePresenceServiceInput) {}

  public readonly markDeviceOnlineOnRegister = (deviceId: string): void => {
    const currentDevice = this.input.devices.get(deviceId);
    const decision = evaluatePresenceTransition({
      currentStatus: currentDevice?.status ?? "missing",
      event: "register",
    });
    if (!decision.shouldTransition || !currentDevice) {
      return;
    }

    this.input.devices.set(deviceId, {
      ...currentDevice,
      status: decision.nextStatus,
    });
  };

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

    const decision = evaluatePresenceTransition({
      currentStatus: device.status,
      event: "socket_close",
      isActiveSocket: true,
    });
    if (!decision.shouldTransition) {
      return;
    }

    this.input.devices.set(deviceId, {
      ...device,
      status: decision.nextStatus,
    });
    this.input.onDeviceOffline?.();
  };

  public readonly markDeviceOfflineFromSocketClose = (
    deviceId: string,
    isActiveSocket: boolean,
  ): void => {
    const device = this.input.devices.get(deviceId);
    const decision = evaluatePresenceTransition({
      currentStatus: device?.status ?? "missing",
      event: "socket_close",
      isActiveSocket,
    });
    if (!decision.shouldTransition || !device) {
      return;
    }

    this.input.devices.set(deviceId, {
      ...device,
      status: decision.nextStatus,
    });
    this.input.onDeviceOffline?.();
  };

  public readonly onHeartbeat = (
    deviceId: string,
    isActiveSocket: boolean,
    socket: WebSocket,
  ): void => {
    const device = this.input.devices.get(deviceId);
    const decision = evaluatePresenceTransition({
      currentStatus: device?.status ?? "missing",
      event: "heartbeat",
      isActiveSocket,
    });
    if (decision.ignoreEvent) {
      return;
    }

    this.armHeartbeatTimeout(deviceId, socket);
  };

  public readonly armHeartbeatTimeout = (
    deviceId: string,
    socket: WebSocket,
  ): void => {
    this.clearHeartbeatTimeout(deviceId);

    const timeoutHandle = setTimeout(() => {
      this.heartbeatTimeouts.delete(deviceId);
      const isActiveSocket = this.input.deviceSockets.get(deviceId) === socket;
      const device = this.input.devices.get(deviceId);
      const decision = evaluatePresenceTransition({
        currentStatus: device?.status ?? "missing",
        event: "heartbeat_timeout",
        isActiveSocket,
      });
      if (decision.ignoreEvent) {
        return;
      }

      this.input.deviceSockets.delete(deviceId);
      if (device && decision.shouldTransition) {
        this.input.devices.set(deviceId, {
          ...device,
          status: decision.nextStatus,
        });
        this.input.onDeviceOffline?.();
      }
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
