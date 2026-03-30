"use client";

import { useState, useCallback, useEffect } from "react";
import type { Command as ServerCommand, Device as ServerDevice } from "@luna/shared-types";
import { Header } from "@/components/luna/header";
import { CommandComposer } from "@/components/luna/command-composer";
import { CommandFeed } from "@/components/luna/command-feed";
import { DevicesPanel } from "@/components/luna/devices-panel";
import { StatsOverview } from "@/components/luna/stats-overview";
import { ActivityList } from "@/components/luna/activity-list";
import { createLunaApiClient } from "@/lib/luna-api";
import {
  buildStats,
  mapCommandsToUi,
  mapDevicesToUi
} from "@/lib/dashboard-data";
import type { CommandResult, Device, SystemStats } from "@/lib/types";

const lunaApiClient = createLunaApiClient();

const emptyStats: SystemStats = {
  totalDevices: 0,
  devicesOnline: 0,
  commandsExecuted: 0,
  recentFailures: 0
};

const applySnapshot = (
  devicesPayload: ServerDevice[],
  commandsPayload: ServerCommand[]
): {
  devices: Device[];
  commands: CommandResult[];
  stats: SystemStats;
} => {
  const devices = mapDevicesToUi(devicesPayload);
  const commands = mapCommandsToUi(commandsPayload, devices);

  return {
    devices,
    commands,
    stats: buildStats(devices, commands)
  };
};

const formatCommandError = (error: unknown): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return "Failed to send command.";
};

export default function LunaDashboard() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [commands, setCommands] = useState<CommandResult[]>([]);
  const [stats, setStats] = useState<SystemStats>(emptyStats);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshDashboard = useCallback(async (): Promise<void> => {
    const [devicesPayload, commandsPayload] = await Promise.all([
      lunaApiClient.fetchDevices(),
      lunaApiClient.fetchCommands()
    ]);
    const snapshot = applySnapshot(devicesPayload, commandsPayload);
    setDevices(snapshot.devices);
    setCommands(snapshot.commands);
    setStats(snapshot.stats);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async (): Promise<void> => {
      try {
        await refreshDashboard();
        if (isMounted) {
          setLoadError(null);
        }
      } catch (error) {
        if (isMounted) {
          setLoadError(formatCommandError(error));
        }
      }
    };

    void loadInitialData();

    const refreshInterval = setInterval(() => {
      void refreshDashboard().catch(() => undefined);
    }, 4_000);

    return () => {
      isMounted = false;
      clearInterval(refreshInterval);
    };
  }, [refreshDashboard]);

  const handleCommand = useCallback(
    async (command: string): Promise<void> => {
      setIsProcessing(true);
      const pendingId = `pending-${Date.now()}`;

      setCommands((previousCommands) => [
        {
          id: pendingId,
          command,
          targetDevice: "Resolving target",
          targetDeviceId: "pending",
          status: "pending",
          message: "Processing...",
          timestamp: "now"
        },
        ...previousCommands
      ]);

      try {
        await lunaApiClient.submitCommand(command);
        await refreshDashboard();
        setLoadError(null);
      } catch (error) {
        const errorMessage = formatCommandError(error);

        setCommands((previousCommands) =>
          previousCommands.map((existingCommand) =>
            existingCommand.id === pendingId
              ? {
                  ...existingCommand,
                  status: "error",
                  message: errorMessage,
                  timestamp: "just now"
                }
              : existingCommand
          )
        );
        setLoadError(errorMessage);
      } finally {
        setIsProcessing(false);
      }
    },
    [refreshDashboard]
  );

  return (
    <div className="min-h-screen bg-background">
      <Header devicesOnline={stats.devicesOnline} totalDevices={stats.totalDevices} />

      <main className="container mx-auto px-4 py-6">
        {loadError && (
          <p className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {loadError}
          </p>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Command Area - Takes 2 columns on large screens */}
          <div className="lg:col-span-2 space-y-6">
            <CommandComposer
              devices={devices}
              onSubmit={handleCommand}
              isProcessing={isProcessing}
            />
            <CommandFeed commands={commands} />
          </div>

          {/* Sidebar - Right panel */}
          <div className="space-y-6">
            <DevicesPanel devices={devices} />
            <StatsOverview stats={stats} />
            <ActivityList commands={commands} />
          </div>
        </div>
      </main>
    </div>
  );
}
