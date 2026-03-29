"use client";

import { Settings, Moon, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";

interface HeaderProps {
  devicesOnline: number;
  totalDevices: number;
}

export function Header({ devicesOnline, totalDevices }: HeaderProps) {
  const systemHealthy = devicesOnline > 0;

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo and Subtitle */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="h-9 w-9 rounded-lg bg-accent/20 flex items-center justify-center">
                  <Moon className="h-5 w-5 text-accent" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success border-2 border-card" />
              </div>
              <div>
                <h1 className="text-xl font-semibold text-foreground tracking-tight">Luna</h1>
                <p className="text-xs text-muted-foreground">Homelab Assistant</p>
              </div>
            </div>
          </div>

          {/* System Status */}
          <div className="flex items-center gap-6">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <Activity className={`h-4 w-4 ${systemHealthy ? "text-success" : "text-destructive"}`} />
              <span className="text-muted-foreground">
                <span className={systemHealthy ? "text-success" : "text-destructive"}>
                  {devicesOnline}
                </span>
                /{totalDevices} devices
              </span>
            </div>

            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
