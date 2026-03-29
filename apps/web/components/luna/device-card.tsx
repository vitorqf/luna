"use client";

import { Laptop, Monitor, Server, Cpu, Wifi, WifiOff } from "lucide-react";
import type { Device, DeviceCapability } from "@/lib/types";

interface DeviceCardProps {
  device: Device;
}

function DeviceIcon({ type }: { type: Device["type"] }) {
  const iconClass = "h-5 w-5";
  switch (type) {
    case "notebook":
      return <Laptop className={iconClass} />;
    case "desktop":
      return <Monitor className={iconClass} />;
    case "server":
      return <Server className={iconClass} />;
    case "mini_pc":
      return <Cpu className={iconClass} />;
  }
}

function CapabilityBadge({ capability }: { capability: DeviceCapability }) {
  const labels: Record<DeviceCapability, string> = {
    notify: "Notify",
    open_app: "Apps",
    set_volume: "Volume",
    play_media: "Media",
    screenshot: "Screenshot",
    shutdown: "Power",
  };

  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
      {labels[capability]}
    </span>
  );
}

export function DeviceCard({ device }: DeviceCardProps) {
  const isOnline = device.status === "online";

  return (
    <div
      className={`p-4 rounded-lg border transition-all ${
        isOnline
          ? "bg-card border-border hover:border-accent/50"
          : "bg-card/50 border-border/50 opacity-60"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div
            className={`h-10 w-10 rounded-lg flex items-center justify-center ${
              isOnline ? "bg-accent/10 text-accent" : "bg-secondary text-muted-foreground"
            }`}
          >
            <DeviceIcon type={device.type} />
          </div>
          <div>
            <h3 className="text-sm font-medium text-foreground">{device.name}</h3>
            <p className="text-xs text-muted-foreground capitalize">
              {device.type.replace("_", " ")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5 text-success" />
              <span className="text-xs text-success">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Offline</span>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {device.capabilities.slice(0, 4).map((cap) => (
          <CapabilityBadge key={cap} capability={cap} />
        ))}
        {device.capabilities.length > 4 && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
            +{device.capabilities.length - 4}
          </span>
        )}
      </div>

      {!isOnline && device.lastSeen && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          Last seen: {device.lastSeen}
        </p>
      )}
    </div>
  );
}
