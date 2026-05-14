"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ApiKeyForm } from "@/components/dashboard/api-key-form";
import { ChartPanel } from "@/components/dashboard/chart-panel";
import { StatCard } from "@/components/dashboard/stat-card";
import { DashboardToolbar } from "@/components/dashboard/dashboard-toolbar";
import {
  runQuery,
  type RawtreeConfig,
  type QueryResult,
} from "@/lib/rawtree-api";
import {
  buildDateRangeQuery,
  buildStatsQuery,
  injectDateFilter,
} from "@/lib/dashboard-queries";
import type { DashboardConfig, DashboardQuery } from "@/lib/types";

type Stats = Record<string, number>;

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
}

function toDateInput(iso: string): string {
  if (iso.length >= 10 && /^\d{4}-\d{2}-\d{2}/.test(iso)) {
    return iso.slice(0, 10);
  }
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function DashboardGrid({ queries, dashboardConfig }: { queries: DashboardQuery[]; dashboardConfig: DashboardConfig }) {
  const [config, setConfig] = useState<RawtreeConfig | null>(null);
  const [results, setResults] = useState<Record<string, QueryResult | null>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [mounted, setMounted] = useState(false);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const executeQueries = useCallback(
    async (cfg: RawtreeConfig, from?: string, to?: string) => {
      const newLoading: Record<string, boolean> = {};
      for (const q of queries) newLoading[q.id] = true;
      setLoading(newLoading);
      setErrors({});
      setResults({});

      try {
        const statsResult = await runQuery(cfg.endpoint, cfg.apiKey, buildStatsQuery(dashboardConfig));
        if (statsResult.data[0]) {
          const row = statsResult.data[0];
          const parsed: Stats = {};
          for (const s of dashboardConfig.stats) {
            parsed[s.key] = Number(row[s.key]) || 0;
          }
          setStats(parsed);
        }
      } catch {
        // stats are non-critical
      }

      await Promise.allSettled(
        queries.map(async (q) => {
          try {
            const sql =
              !q.skipDateFilter && from && to
                ? injectDateFilter(q.sql, from, to, dashboardConfig.dateExpression)
                : q.sql;
            const result = await runQuery(cfg.endpoint, cfg.apiKey, sql);
            setResults((prev) => ({ ...prev, [q.id]: result }));
          } catch (e) {
            setErrors((prev) => ({
              ...prev,
              [q.id]: e instanceof Error ? e.message : "Query failed",
            }));
          } finally {
            setLoading((prev) => ({ ...prev, [q.id]: false }));
          }
        })
      );
    },
    [queries, dashboardConfig]
  );

  const initDashboard = useCallback(
    async (cfg: RawtreeConfig) => {
      try {
        const rangeResult = await runQuery(cfg.endpoint, cfg.apiKey, buildDateRangeQuery(dashboardConfig));
        if (rangeResult.data[0]) {
          const row = rangeResult.data[0];
          setDateFrom(toDateInput(String(row.min_date)));
          setDateTo(toDateInput(String(row.max_date)));
        }
      } catch {
        // date range is non-critical
      }
      executeQueries(cfg);
    },
    [executeQueries, dashboardConfig]
  );

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefresh && config) {
      intervalRef.current = setInterval(() => {
        executeQueries(config, dateFrom || undefined, dateTo || undefined);
      }, 30_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, config, dateFrom, dateTo, executeQueries]);

  function handleConnect(cfg: RawtreeConfig) {
    setConfig(cfg);
    initDashboard(cfg);
  }

  function handleDisconnect() {
    setConfig(null);
    setResults({});
    setErrors({});
    setStats(null);
    setDateFrom("");
    setDateTo("");
    setAutoRefresh(false);
  }

  function handleDateChange(from: string, to: string) {
    setDateFrom(from);
    setDateTo(to);
    if (config) executeQueries(config, from, to);
  }

  if (!mounted) return null;

  if (!config) {
    return <ApiKeyForm onConnect={handleConnect} />;
  }

  return (
    <div>
      <DashboardToolbar
        endpoint={config.endpoint}
        dateFrom={dateFrom}
        dateTo={dateTo}
        autoRefresh={autoRefresh}
        onDateChange={handleDateChange}
        onAutoRefreshToggle={() => setAutoRefresh((v) => !v)}
        onRefresh={() =>
          executeQueries(config, dateFrom || undefined, dateTo || undefined)
        }
        onDisconnect={handleDisconnect}
      />

      {stats && dashboardConfig.stats.length > 0 && (
        <div className={`mb-3 grid grid-cols-2 gap-3 ${
          { 1: "sm:grid-cols-1", 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-4" }[
            Math.min(dashboardConfig.stats.length, 4) as 1 | 2 | 3 | 4
          ]
        }`}>
          {dashboardConfig.stats.map((s) => (
            <StatCard key={s.key} label={s.label} value={formatNumber(stats[s.key] ?? 0)} />
          ))}
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {queries.map((q) => (
          <ChartPanel
            key={q.id}
            query={q}
            result={results[q.id] ?? null}
            error={errors[q.id] ?? null}
            loading={loading[q.id] ?? false}
          />
        ))}
      </div>
    </div>
  );
}
