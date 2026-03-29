"use client";

import { Clock, CheckCircle2, XCircle, Monitor } from "lucide-react";
import type { CommandResult } from "@/lib/types";

interface ActivityListProps {
  commands: CommandResult[];
}

export function ActivityList({ commands }: ActivityListProps) {
  const recentCommands = commands.slice(0, 5);

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-medium text-foreground">History</h2>
        </div>
      </div>

      <div className="space-y-2">
        {recentCommands.map((cmd) => (
          <div
            key={cmd.id}
            className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            {cmd.status === "success" ? (
              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
            
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground truncate">{cmd.command}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Monitor className="h-3 w-3" />
                <span>{cmd.targetDevice}</span>
                <span>•</span>
                <span>{cmd.timestamp}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {commands.length > 5 && (
        <button className="mt-4 w-full text-center text-sm text-accent hover:text-accent/80 transition-colors">
          View all history
        </button>
      )}
    </div>
  );
}
