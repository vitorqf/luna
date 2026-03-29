"use client";

import { CheckCircle2, XCircle, Clock, Terminal, Monitor } from "lucide-react";
import type { CommandResult } from "@/lib/types";

interface CommandFeedProps {
  commands: CommandResult[];
}

function StatusIcon({ status }: { status: CommandResult["status"] }) {
  switch (status) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "error":
      return <XCircle className="h-4 w-4 text-destructive" />;
    case "pending":
      return <Clock className="h-4 w-4 text-warning animate-pulse" />;
  }
}

function StatusBadge({ status }: { status: CommandResult["status"] }) {
  const styles = {
    success: "bg-success/10 text-success border-success/20",
    error: "bg-destructive/10 text-destructive border-destructive/20",
    pending: "bg-warning/10 text-warning border-warning/20",
  };

  const labels = {
    success: "Success",
    error: "Failed",
    pending: "Pending",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full border ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export function CommandFeed({ commands }: CommandFeedProps) {
  if (commands.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Terminal className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-medium text-foreground">Recent Activity</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center mb-4">
            <Terminal className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No commands yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Send a command to get started
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-medium text-foreground">Recent Activity</h2>
      </div>

      <div className="space-y-3">
        {commands.map((cmd) => (
          <div
            key={cmd.id}
            className="p-4 rounded-lg bg-secondary/50 border border-border/50 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="flex items-center gap-2 min-w-0">
                <StatusIcon status={cmd.status} />
                <span className="text-sm font-medium text-foreground truncate">
                  {cmd.command}
                </span>
              </div>
              <StatusBadge status={cmd.status} />
            </div>

            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Monitor className="h-3.5 w-3.5" />
                <span>{cmd.targetDevice}</span>
              </div>
              <span>•</span>
              <span>{cmd.timestamp}</span>
            </div>

            {cmd.message && (
              <p className="mt-2 text-xs text-muted-foreground bg-background/50 px-3 py-2 rounded-md font-mono">
                {cmd.message}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
