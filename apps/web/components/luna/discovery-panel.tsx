"use client";

import { useState } from "react";
import { Radar, Check } from "lucide-react";
import type { DiscoveredAgent } from "@/lib/types";

interface DiscoveryPanelProps {
  discoveredAgents: DiscoveredAgent[];
  onApprove: (discoveredAgentId: string) => Promise<void>;
}

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to approve discovered agent.";
};

export function DiscoveryPanel({
  discoveredAgents,
  onApprove
}: DiscoveryPanelProps) {
  const [isApprovingById, setIsApprovingById] = useState<Record<string, boolean>>(
    {}
  );
  const [errorById, setErrorById] = useState<Record<string, string>>({});

  const handleApprove = async (discoveredAgentId: string): Promise<void> => {
    setIsApprovingById((previousState) => ({
      ...previousState,
      [discoveredAgentId]: true
    }));
    setErrorById((previousState) => {
      const nextState = { ...previousState };
      delete nextState[discoveredAgentId];
      return nextState;
    });

    try {
      await onApprove(discoveredAgentId);
    } catch (error) {
      setErrorById((previousState) => ({
        ...previousState,
        [discoveredAgentId]: readErrorMessage(error)
      }));
    } finally {
      setIsApprovingById((previousState) => ({
        ...previousState,
        [discoveredAgentId]: false
      }));
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radar className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-medium text-foreground">Discovery</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {discoveredAgents.length} pending
        </span>
      </div>

      {discoveredAgents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No discovered agents pending approval.
        </p>
      ) : (
        <div className="space-y-3">
          {discoveredAgents.map((agent) => (
            <div
              key={agent.id}
              className="rounded-lg border border-border bg-background/40 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{agent.hostname}</p>
                  <p className="text-xs text-muted-foreground">id: {agent.id}</p>
                  <p className="text-xs text-muted-foreground">
                    capabilities: {agent.capabilities.join(", ")}
                  </p>
                  {errorById[agent.id] && (
                    <p className="mt-1 text-xs text-destructive">{errorById[agent.id]}</p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleApprove(agent.id)}
                  disabled={isApprovingById[agent.id] === true}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Check className="h-3.5 w-3.5" />
                  {isApprovingById[agent.id] ? "Approving..." : "Approve"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
