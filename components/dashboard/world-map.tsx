"use client";

import WorldMap, { type DataItem } from "react-svg-worldmap";

interface WorldMapPanelProps {
  data: Record<string, unknown>[];
  countryKey: string;
  valueKey: string;
  color?: string;
  height?: number;
}

export function WorldMapPanel({ data, countryKey, valueKey, color = "#3b82f6", height = 200 }: WorldMapPanelProps) {
  const mapData: DataItem[] = data
    .map((row) => ({
      country: String(row[countryKey] ?? "").toLowerCase() as DataItem["country"],
      value: Number(row[valueKey]) || 0,
    }))
    .filter((d) => d.country.length === 2 && d.value > 0);

  return (
    <div className="flex items-center justify-center overflow-hidden" style={{ height }}>
      <div className="w-full" style={{ maxWidth: height * 1.6 }}>
      <WorldMap
        color={color}
        valueSuffix="requests"
        size="responsive"
        data={mapData}
        richInteraction
        tooltipTextFunction={(ctx) =>
          `${ctx.countryName}: ${ctx.countryValue?.toLocaleString() ?? 0} requests`
        }
        styleFunction={(ctx) => ({
          fill: ctx.countryValue ? ctx.color : "var(--muted)",
          stroke: "var(--border)",
          strokeWidth: 0.5,
          cursor: ctx.countryValue ? "pointer" : "default",
        })}
      />
      </div>
    </div>
  );
}
