"use client";

import { useState, useEffect } from "react";
import { Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { commandPlaceholders } from "@/lib/mock-data";

interface CommandComposerProps {
  onSubmit: (command: string) => void;
  isProcessing?: boolean;
}

export function CommandComposer({ onSubmit, isProcessing = false }: CommandComposerProps) {
  const [command, setCommand] = useState("");
  const [placeholder, setPlaceholder] = useState(commandPlaceholders[0]);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholder(commandPlaceholders[Math.floor(Math.random() * commandPlaceholders.length)]);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim() && !isProcessing) {
      onSubmit(command.trim());
      setCommand("");
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
            onChange={(e) => setCommand(e.target.value)}
            placeholder={placeholder}
            disabled={isProcessing}
            className="w-full h-12 px-4 rounded-lg bg-input border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent transition-all disabled:opacity-50"
          />
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
        {["Notebook 2", "Mini PC Homelab", "Server Principal"].map((device) => (
          <button
            key={device}
            type="button"
            onClick={() => setCommand(`Notificar "Mensagem do Luna" no ${device}`)}
            className="text-xs px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
          >
            {device}
          </button>
        ))}
      </div>
    </div>
  );
}

