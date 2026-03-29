"use client";

import { Activity, Cpu, Terminal, AlertTriangle } from "lucide-react";
import type { SystemStats } from "@/lib/types";

interface StatsOverviewProps {
  stats: SystemStats;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subtext?: string;
  variant?: "default" | "success" | "warning" | "destructive";
}

function StatCard({ icon, label, value, subtext, variant = "default" }: StatCardProps) {
  const variants = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${variants[variant]}`}>{value}</div>
      {subtext && <p className="text-xs text-muted-foreground mt-1">{subtext}</p>}
    </div>
  );
}

export function StatsOverview({ stats }: StatsOverviewProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-medium text-foreground">System Overview</h2>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          icon={<Cpu className="h-4 w-4" />}
          label="Total Devices"
          value={stats.totalDevices}
        />
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Online"
          value={stats.devicesOnline}
          variant="success"
        />
        <StatCard
          icon={<Terminal className="h-4 w-4" />}
          label="Commands"
          value={stats.commandsExecuted}
          subtext="Last 24h"
        />
        <StatCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="Failures"
          value={stats.recentFailures}
          variant={stats.recentFailures > 0 ? "destructive" : "default"}
          subtext="Last 24h"
        />
      </div>
    </div>
  );
}
