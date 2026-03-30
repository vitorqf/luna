"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commandPlaceholders } from "@/lib/mock-data";
import type { Device } from "@/lib/types";
import {
  applyDeviceSuggestion,
  extractDeviceSuggestionContext,
  getOnlineDeviceSuggestions
} from "@/lib/device-suggestions";

interface CommandComposerProps {
  devices: Device[];
  onSubmit: (command: string) => void;
  isProcessing?: boolean;
}

export function CommandComposer({
  devices,
  onSubmit,
  isProcessing = false
}: CommandComposerProps) {
  const [command, setCommand] = useState("");
  const [placeholder, setPlaceholder] = useState(commandPlaceholders[0]);
  const [isSuggestionMenuOpen, setIsSuggestionMenuOpen] = useState(true);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholder(commandPlaceholders[Math.floor(Math.random() * commandPlaceholders.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const suggestionContext = useMemo(
    () => extractDeviceSuggestionContext(command),
    [command]
  );
  const deviceSuggestions = useMemo(
    () =>
      suggestionContext
        ? getOnlineDeviceSuggestions(devices, suggestionContext.fragment)
        : [],
    [devices, suggestionContext]
  );
  const quickActionDevices = useMemo(
    () => devices.filter((device) => device.status === "online").slice(0, 3),
    [devices]
  );

  useEffect(() => {
    if (deviceSuggestions.length === 0) {
      setActiveSuggestionIndex(0);
      return;
    }

    setActiveSuggestionIndex(0);
  }, [deviceSuggestions]);

  const isSuggestionsVisible =
    isSuggestionMenuOpen && deviceSuggestions.length > 0;

  const applySuggestion = useCallback(
    (deviceName: string) => {
      if (!suggestionContext) {
        return;
      }

      setCommand(applyDeviceSuggestion(command, suggestionContext, deviceName));
      setIsSuggestionMenuOpen(false);
      setActiveSuggestionIndex(0);
    },
    [command, suggestionContext]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isProcessing) {
      onSubmit(command.trim());
      setCommand("");
      setIsSuggestionMenuOpen(true);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSuggestionsVisible) {
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveSuggestionIndex((index) =>
        index + 1 >= deviceSuggestions.length ? 0 : index + 1
      );
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveSuggestionIndex((index) =>
        index - 1 < 0 ? deviceSuggestions.length - 1 : index - 1
      );
      return;
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setIsSuggestionMenuOpen(false);
      return;
    }

    if (e.key === "Enter" || e.key === "Tab") {
      const selectedSuggestion =
        deviceSuggestions[activeSuggestionIndex] ?? deviceSuggestions[0];
      if (!selectedSuggestion) {
        return;
      }

      e.preventDefault();
      applySuggestion(selectedSuggestion.name);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-lg">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-medium text-foreground">Command Center</h2>
      </div>
      
      <p className="text-sm text-muted-foreground mb-4">
        Send commands to your devices using natural language
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={command}
            onChange={(e) => {
              setCommand(e.target.value);
              setIsSuggestionMenuOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isProcessing}
            className="w-full h-12 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50"
          />
          {isSuggestionsVisible && (
            <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-20 rounded-lg border border-border bg-card p-1 shadow-xl">
              {deviceSuggestions.map((device, index) => (
                <button
                  key={device.id}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    applySuggestion(device.name);
                  }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    index === activeSuggestionIndex
                      ? "bg-secondary text-secondary-foreground"
                      : "text-foreground hover:bg-secondary/70"
                  }`}
                >
                  {device.name}
                </button>
              ))}
            </div>
          )}
        </div>
        <Button
          type="submit"
          disabled={!command.trim() || isProcessing}
          className="h-12 px-6 bg-accent hover:bg-accent/90 text-accent-foreground font-medium"
        >
          <Send className="h-4 w-4 mr-2" />
          {isProcessing ? "Sending..." : "Send"}
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        {quickActionDevices.map((device) => (
          <button
            key={device.id}
            type="button"
            onClick={() => {
              setCommand(`Notificar "Mensagem do Luna" no ${device.name}`);
              setIsSuggestionMenuOpen(false);
            }}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {device.name}
          </button>
        ))}
      </div>
    </div>
  );
}

