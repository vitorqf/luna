import { createAgentHeartbeatMessage } from "@luna/protocol";
import type { DeviceCapability } from "@luna/shared-types";
import { createDiscoveryAnnouncer } from "./discovery-announcer";
import type { AgentSession } from "./agent-session";

export type AgentOperationalLifecycleTimer = ReturnType<typeof setInterval>;

export interface AgentOperationalLifecycleInput {
  session: AgentSession;
  serverUrl: string;
  device: {
    id: string;
    hostname: string;
    capabilities: DeviceCapability[];
  };
  heartbeatIntervalMs: number;
  discoveryIntervalMs: number;
  onDisconnect?: (() => void) | undefined;
}

export interface AgentOperationalLifecycle {
  disconnect: () => Promise<void>;
}

interface AgentOperationalLifecycleDeps {
  setIntervalFn: typeof setInterval;
  clearIntervalFn: typeof clearInterval;
  startDiscoveryAnnouncer: ReturnType<typeof createDiscoveryAnnouncer>;
  logDiscoveryStartError: (input: {
    deviceId: string;
    error: unknown;
  }) => void;
}

const getErrorReason = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Unknown launcher error.";
};

const defaultDeps: AgentOperationalLifecycleDeps = {
  setIntervalFn: setInterval,
  clearIntervalFn: clearInterval,
  startDiscoveryAnnouncer: createDiscoveryAnnouncer(),
  logDiscoveryStartError: ({ deviceId, error }) => {
    console.error("[luna][discovery][error]", {
      deviceId,
      reason: getErrorReason(error),
    });
  },
};

export const createAgentOperationalLifecycle = (
  input: AgentOperationalLifecycleInput,
  deps: AgentOperationalLifecycleDeps = defaultDeps,
): AgentOperationalLifecycle => {
  let heartbeatInterval: AgentOperationalLifecycleTimer | undefined;
  let discoveryAnnouncer:
    | {
        stop: () => void;
      }
    | undefined;
  let hasHandledClose = false;

  const cleanupOperationalResources = (): void => {
    if (heartbeatInterval) {
      deps.clearIntervalFn(heartbeatInterval);
      heartbeatInterval = undefined;
    }

    if (discoveryAnnouncer) {
      discoveryAnnouncer.stop();
      discoveryAnnouncer = undefined;
    }
  };

  const handleClose = (): void => {
    if (hasHandledClose) {
      return;
    }

    hasHandledClose = true;
    cleanupOperationalResources();
    input.onDisconnect?.();
  };

  input.session.onClose(handleClose);

  try {
    discoveryAnnouncer = deps.startDiscoveryAnnouncer({
      serverUrl: input.serverUrl,
      device: {
        id: input.device.id,
        hostname: input.device.hostname,
        capabilities: [...input.device.capabilities],
      },
      intervalMs: input.discoveryIntervalMs,
    });
  } catch (error) {
    deps.logDiscoveryStartError({
      deviceId: input.device.id,
      error,
    });
  }

  if (input.heartbeatIntervalMs > 0) {
    heartbeatInterval = deps.setIntervalFn(() => {
      if (!input.session.isOpen()) {
        return;
      }

      void input.session
        .sendSerializedMessage(
          JSON.stringify(createAgentHeartbeatMessage({})),
        )
        .catch(() => undefined);
    }, input.heartbeatIntervalMs);
  }

  return {
    disconnect: async () => {
      cleanupOperationalResources();

      if (!input.session.isOpen()) {
        return;
      }

      await input.session.disconnect();
    },
  };
};
