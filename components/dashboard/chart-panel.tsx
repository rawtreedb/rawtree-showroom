"use client";

import { useState } from "react";
import { Code2, BarChart3 } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { SqlHighlight } from "@/components/dashboard/sql-highlight";
import type { DashboardQuery } from "@/lib/types";
import type { QueryResult } from "@/lib/rawtree-api";

const PIE_COLORS = [
  "oklch(0.6 0.2 265)",
  "oklch(0.65 0.18 150)",
  "oklch(0.7 0.18 85)",
  "oklch(0.65 0.15 30)",
  "oklch(0.6 0.15 200)",
  "oklch(0.55 0.2 330)",
  "oklch(0.7 0.12 120)",
  "oklch(0.6 0.18 50)",
  "oklch(0.55 0.15 280)",
  "oklch(0.65 0.12 170)",
];

const TOOLTIP_STYLE = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  fontSize: 11,
};

function formatTick(value: string) {
  if (!value) return "";
  if (value.includes("T") || value.includes(" ")) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
  }
  if (typeof value === "string" && value.length > 16) {
    return value.slice(0, 14) + "…";
  }
  return value;
}

function ChartRenderer({
  query,
  data,
}: {
  query: DashboardQuery;
  data: Record<string, unknown>[];
}) {
  const { chartType, chartConfig } = query;
  const color = chartConfig.colors?.[0] ?? "var(--color-primary)";

  if (chartType === "area") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
            className="text-muted-foreground"
          />
          <YAxis tick={{ fontSize: 9 }} className="text-muted-foreground" width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {chartConfig.yKeys.map((key, i) => (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartConfig.colors?.[i] ?? color}
              fill={chartConfig.colors?.[i] ?? color}
              fillOpacity={0.15}
              strokeWidth={1.5}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "horizontal-bar") {
    const labelKey = chartConfig.yKeys[0];
    const valueKey = chartConfig.xKey;
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} layout="vertical" margin={{ left: 60 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis type="number" tick={{ fontSize: 9 }} />
          <YAxis
            dataKey={labelKey}
            type="category"
            tick={{ fontSize: 9 }}
            width={55}
            tickFormatter={formatTick}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Bar dataKey={valueKey} fill={color} radius={[0, 3, 3, 0]} />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "bar") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
          />
          <YAxis tick={{ fontSize: 9 }} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {chartConfig.yKeys.map((key, i) => (
            <Bar
              key={key}
              dataKey={key}
              fill={chartConfig.colors?.[i] ?? color}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line") {
    return (
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey={chartConfig.xKey}
            tickFormatter={formatTick}
            tick={{ fontSize: 9 }}
          />
          <YAxis tick={{ fontSize: 9 }} width={40} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          {chartConfig.yKeys.map((key, i) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={chartConfig.colors?.[i] ?? color}
              strokeWidth={1.5}
              dot={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "pie") {
    const nameKey = chartConfig.yKeys[0];
    const valueKey = chartConfig.xKey;
    return (
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            dataKey={valueKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={45}
            outerRadius={80}
            paddingAngle={2}
            label={(props) => {
              const percent = props.percent ?? 0;
              const name = props.name ?? "";
              return percent > 0.04 ? `${String(name).slice(0, 12)} ${(percent * 100).toFixed(0)}%` : "";
            }}
            labelLine={false}
            style={{ fontSize: 9 }}
          >
            {data.map((_, index) => (
              <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  return <p className="text-sm text-muted-foreground">Unsupported chart type</p>;
}

export function ChartPanel({
  query,
  result,
  error,
  loading,
}: {
  query: DashboardQuery;
  result: QueryResult | null;
  error: string | null;
  loading: boolean;
}) {
  const [showSql, setShowSql] = useState(false);
  const [hasToggled, setHasToggled] = useState(false);
  const [animKey, setAnimKey] = useState(0);

  function toggle() {
    setShowSql((v) => !v);
    setHasToggled(true);
    setAnimKey((k) => k + 1);
  }

  return (
    <div key={animKey} className={`rounded-xl border bg-card ${hasToggled ? "chart-panel-animate" : ""}`}>
      <div className="flex items-start justify-between border-b px-3 py-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xs font-semibold">{query.title}</h3>
          {!showSql && (
            <p className="truncate text-[10px] text-muted-foreground">
              {query.description}
            </p>
          )}
        </div>
        <button
          onClick={toggle}
          className="ml-2 shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title={showSql ? "Show chart" : "Show SQL"}
        >
          {showSql ? (
            <BarChart3 className="size-3.5" />
          ) : (
            <Code2 className="size-3.5" />
          )}
        </button>
      </div>

      {showSql ? (
        <div className="overflow-auto p-2" style={{ maxHeight: "240px" }}>
          <SqlHighlight sql={query.sql} />
        </div>
      ) : (
        <div className="p-2">
          {loading && (
            <div className="flex h-[200px] items-center justify-center">
              <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
          {error && (
            <div className="flex h-[200px] items-center justify-center px-3">
              <p className="text-center text-xs text-destructive">{error}</p>
            </div>
          )}
          {!loading && !error && result && (
            <ChartRenderer query={query} data={result.data} />
          )}
        </div>
      )}
    </div>
  );
}
