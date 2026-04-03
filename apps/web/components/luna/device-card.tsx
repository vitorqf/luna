"use client";

import { useEffect, useState } from "react";
import {
  Laptop,
  Monitor,
  Server,
  Cpu,
  Wifi,
  WifiOff,
  Pencil,
  Check,
  X
} from "lucide-react";
import type { Device, DeviceCapability } from "@/lib/types";
import {
  cancelDeviceRename,
  createEditingDeviceRenameState,
  type DeviceRenameState
} from "@/lib/device-rename-flow";

interface DeviceCardProps {
  device: Device;
  onRenameDevice?: (deviceId: string, draftName: string) => Promise<void>;
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
  };

  return (
    <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/50">
      {labels[capability]}
    </span>
  );
}

const readErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to rename device.";
};

export function DeviceCard({ device, onRenameDevice }: DeviceCardProps) {
  const isOnline = device.status === "online";
  const [renameState, setRenameState] = useState<DeviceRenameState>(() =>
    cancelDeviceRename(device.name)
  );
  const [isSavingRename, setIsSavingRename] = useState(false);

  useEffect(() => {
    setRenameState((previousState) =>
      previousState.isEditing
        ? previousState
        : cancelDeviceRename(device.name)
    );
  }, [device.name]);

  const startRename = () => {
    setRenameState(createEditingDeviceRenameState(device.name));
  };

  const cancelRename = () => {
    setRenameState(cancelDeviceRename(device.name));
  };

  const saveRename = async (): Promise<void> => {
    if (!onRenameDevice) {
      return;
    }

    setIsSavingRename(true);
    setRenameState((previousState) => ({
      ...previousState,
      errorMessage: null
    }));

    try {
      await onRenameDevice(device.id, renameState.draftName);
      setRenameState(cancelDeviceRename(renameState.draftName));
    } catch (error) {
      setRenameState((previousState) => ({
        ...previousState,
        errorMessage: readErrorMessage(error)
      }));
    } finally {
      setIsSavingRename(false);
    }
  };

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
            {!renameState.isEditing ? (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium text-foreground">{device.name}</h3>
                <button
                  type="button"
                  onClick={startRename}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label={`Rename ${device.name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={renameState.draftName}
                  onChange={(event) =>
                    setRenameState((previousState) => ({
                      ...previousState,
                      draftName: event.target.value,
                      errorMessage: null
                    }))
                  }
                  className="h-7 w-36 rounded-md border border-border bg-input px-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent/40"
                  disabled={isSavingRename}
                />
                <button
                  type="button"
                  onClick={() => void saveRename()}
                  className="text-success transition-colors hover:text-success/80 disabled:opacity-50"
                  disabled={isSavingRename}
                  aria-label="Save rename"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cancelRename}
                  className="text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                  disabled={isSavingRename}
                  aria-label="Cancel rename"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <p className="text-xs text-muted-foreground capitalize">
              {device.type.replace("_", " ")}
            </p>
            <p className="text-[11px] text-muted-foreground/80">{device.hostname}</p>
            {renameState.errorMessage && (
              <p className="text-[11px] text-destructive">{renameState.errorMessage}</p>
            )}
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
