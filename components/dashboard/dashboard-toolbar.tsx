"use client";

import { useState } from "react";
import { RefreshCw, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DashboardToolbarProps {
  endpoint: string;
  dateFrom: string;
  dateTo: string;
  autoRefresh: boolean;
  onDateChange: (from: string, to: string) => void;
  onAutoRefreshToggle: () => void;
  onRefresh: () => void;
  onDisconnect: () => void;
}

export function DashboardToolbar({
  endpoint,
  dateFrom,
  dateTo,
  autoRefresh,
  onDateChange,
  onAutoRefreshToggle,
  onRefresh,
  onDisconnect,
}: DashboardToolbarProps) {
  const [localFrom, setLocalFrom] = useState(dateFrom);
  const [localTo, setLocalTo] = useState(dateTo);
  const [prevDateFrom, setPrevDateFrom] = useState(dateFrom);
  const [prevDateTo, setPrevDateTo] = useState(dateTo);

  if (dateFrom !== prevDateFrom) {
    setPrevDateFrom(dateFrom);
    setLocalFrom(dateFrom);
  }
  if (dateTo !== prevDateTo) {
    setPrevDateTo(dateTo);
    setLocalTo(dateTo);
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border bg-card px-4 py-2">
      <p className="text-xs text-muted-foreground">
        <span className="font-mono text-[10px] text-foreground">{endpoint}</span>
      </p>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs">
          <label className="text-muted-foreground">From</label>
          <input
            type="date"
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <label className="text-muted-foreground">To</label>
          <input
            type="date"
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="rounded-md border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => onDateChange(localFrom, localTo)}
          >
            Apply
          </Button>
        </div>

        <div className="h-5 w-px bg-border" />

        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={onAutoRefreshToggle}
            className="rounded"
          />
          30s
        </label>

        <div className="h-5 w-px bg-border" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onRefresh}
        >
          <RefreshCw className="size-3" />
          Refresh
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-xs"
          onClick={onDisconnect}
        >
          <LogOut className="size-3" />
        </Button>
      </div>
    </div>
  );
}
