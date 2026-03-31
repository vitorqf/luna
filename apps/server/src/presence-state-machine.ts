import type { DeviceStatus } from "@luna/shared-types";

export type PresenceCurrentStatus = DeviceStatus | "missing";

export type PresenceEvent =
  | "register"
  | "socket_close"
  | "heartbeat"
  | "heartbeat_timeout";

export interface EvaluatePresenceTransitionInput {
  currentStatus: PresenceCurrentStatus;
  event: PresenceEvent;
  isActiveSocket?: boolean;
}

export interface PresenceTransitionDecision {
  nextStatus: DeviceStatus;
  shouldTransition: boolean;
  ignoreEvent: boolean;
}

export const evaluatePresenceTransition = (
  input: EvaluatePresenceTransitionInput,
): PresenceTransitionDecision => {
  if (input.event === "register") {
    if (input.currentStatus === "online") {
      return {
        nextStatus: "online",
        shouldTransition: false,
        ignoreEvent: false,
      };
    }

    return {
      nextStatus: "online",
      shouldTransition: true,
      ignoreEvent: false,
    };
  }

  if (input.event === "socket_close" || input.event === "heartbeat_timeout") {
    if (input.isActiveSocket === false) {
      return {
        nextStatus: input.currentStatus === "missing" ? "offline" : input.currentStatus,
        shouldTransition: false,
        ignoreEvent: true,
      };
    }

    if (input.currentStatus !== "online") {
      return {
        nextStatus: input.currentStatus === "missing" ? "offline" : input.currentStatus,
        shouldTransition: false,
        ignoreEvent: true,
      };
    }

    return {
      nextStatus: "offline",
      shouldTransition: true,
      ignoreEvent: false,
    };
  }

  if (input.event === "heartbeat") {
    if (input.isActiveSocket === false) {
      return {
        nextStatus: input.currentStatus === "missing" ? "offline" : input.currentStatus,
        shouldTransition: false,
        ignoreEvent: true,
      };
    }

    if (input.currentStatus === "online") {
      return {
        nextStatus: "online",
        shouldTransition: false,
        ignoreEvent: false,
      };
    }

    return {
      nextStatus: input.currentStatus === "missing" ? "offline" : input.currentStatus,
      shouldTransition: false,
      ignoreEvent: true,
    };
  }

  return {
    nextStatus: input.currentStatus === "missing" ? "offline" : input.currentStatus,
    shouldTransition: false,
    ignoreEvent: true,
  };
};
