"use client";

import { HardDrive } from "lucide-react";
import { DeviceCard } from "./device-card";
import type { Device } from "@/lib/types";

interface DevicesPanelProps {
  devices: Device[];
}

export function DevicesPanel({ devices }: DevicesPanelProps) {
  const onlineDevices = devices.filter((d) => d.status === "online");
  const offlineDevices = devices.filter((d) => d.status === "offline");

  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardDrive className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-medium text-foreground">Devices</h2>
        </div>
        <span className="text-xs text-muted-foreground">
          {onlineDevices.length}/{devices.length} online
        </span>
      </div>

      <div className="space-y-3">
        {/* Online devices first */}
        {onlineDevices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
        
        {/* Offline devices */}
        {offlineDevices.map((device) => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>
    </div>
  );
}
