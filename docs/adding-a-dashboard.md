# Adding a New Dashboard

This guide walks through adding a new use case with a live dashboard to the showroom.

## Overview

Each dashboard is defined entirely in a content file — no infrastructure code changes needed. You provide:

1. **Dashboard config** — table name, date column, dedup columns, stat cards
2. **Chart queries** — SQL queries with chart type and axis mapping
3. **Use case metadata** — title, description, tags, architecture diagram, setup guides

## Step-by-step

### 1. Create the content file

Create `content/use-cases/<your-slug>.ts`:

```typescript
import type { UseCase } from "@/lib/types";
import { buildDedupCte } from "@/lib/dashboard-queries";

// Dashboard configuration
const dashboardConfig = {
  table: "my_table",
  dateExpression: "toDateTime(timestamp)",
  dedupIdColumn: "_rt_id",
  dedupTsColumn: "_rt_ts",
  stats: [
    {
      label: "Total Records",
      sqlExpression: "count() AS total_records",
      key: "total_records",
    },
    {
      label: "Unique Users",
      sqlExpression: "uniq(user_id) AS unique_users",
      key: "unique_users",
    },
  ],
};

// Build the dedup CTE once, reuse across queries
const CTE = buildDedupCte(dashboardConfig);

export const myUseCase: UseCase = {
  slug: "my-use-case",
  title: "My Use Case",
  shortDescription: "One-line summary for the gallery card.",
  description: "Full description shown on the use case detail page.",
  tags: ["Tag1", "Tag2"],
  category: "Category Name",
  heroImage: "/use-cases/my-use-case/thumbnail.png",
  connectorUrl: "https://github.com/rawtreedb/my-connector",
  connectorName: "my-connector",
  architecture: {
    nodes: [
      { id: "source", label: "Source", type: "source" },
      { id: "connector", label: "Connector", type: "connector" },
      { id: "rawtree", label: "RawTree", type: "platform" },
      { id: "dashboard", label: "Dashboard", type: "dashboard" },
    ],
    edges: [
      { from: "source", to: "connector", label: "CDC" },
      { from: "connector", to: "rawtree", label: "HTTP API" },
      { from: "rawtree", to: "dashboard", label: "SQL" },
    ],
  },
  dashboardConfig,
  dashboardQueries: [
    {
      id: "records-over-time",
      title: "Records Over Time",
      description: "Record count per hour",
      sql: `${CTE}
SELECT
    toStartOfHour(toDateTime(timestamp)) AS bucket,
    count() AS records
FROM events
GROUP BY bucket
ORDER BY bucket`,
      chartType: "area",
      chartConfig: {
        xKey: "bucket",
        yKeys: ["records"],
        colors: ["var(--color-primary)"],
      },
    },
  ],
  setupGuides: [
    {
      method: "Docker",
      steps: [
        {
          title: "Run the connector",
          content: "Pull and run the connector image.",
          codeBlock: {
            language: "bash",
            code: "docker run rawtreedb/my-connector",
          },
        },
      ],
    },
  ],
  publishedAt: "2026-01-01",
};
```

### 2. Register the use case

Add your use case to `lib/use-cases.ts`:

```typescript
import { myUseCase } from "@/content/use-cases/my-use-case";

const useCases: UseCase[] = [ghArchiveMongodbCdc, myUseCase];
```

### 3. Add the thumbnail

Place your dashboard screenshot at:

```
public/use-cases/<your-slug>/thumbnail.png
```

This image appears on the gallery card. Recommended dimensions: ~3500x1700px (roughly 2:1 aspect ratio).

### 4. Build and verify

```bash
npm run build
```

Visit `/use-cases/<your-slug>/dashboard` to test.

## Reference

### Dashboard config (`DashboardConfig`)

| Field | Description | Example |
|-------|-------------|---------|
| `table` | ClickHouse table name | `"mongo_events"` |
| `dateExpression` | ClickHouse expression for the timestamp column used in date filtering | `"toDateTime(timestamp)"` |
| `dedupIdColumn` | Column used for deduplication (PARTITION BY) | `"_rt_id"` |
| `dedupTsColumn` | Column used for dedup ordering (ORDER BY DESC) | `"_rt_ts"` |
| `stats` | Array of stat cards shown above the chart grid | See below |

### Stat cards (`DashboardStat`)

| Field | Description | Example |
|-------|-------------|---------|
| `label` | Display label on the card | `"Total Events"` |
| `sqlExpression` | SQL aggregate expression with alias | `"count() AS total_events"` |
| `key` | Column alias to read from the result row | `"total_events"` |

Stats are fetched in a single query wrapped in the dedup CTE. Up to 4 stat cards are supported (responsive grid: 2 columns on mobile, up to 4 on desktop).

### Chart queries (`DashboardQuery`)

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `title` | Chart panel header |
| `description` | Subtitle shown below the title |
| `sql` | Full SQL query (use `buildDedupCte()` for the CTE prefix) |
| `chartType` | `"area"` \| `"bar"` \| `"horizontal-bar"` \| `"line"` \| `"pie"` |
| `chartConfig.xKey` | Column mapped to X axis (or value key for pie/horizontal-bar) |
| `chartConfig.yKeys` | Columns mapped to Y axis (or label key for pie/horizontal-bar) |
| `chartConfig.colors` | Optional color array (CSS values or OKLCH) |
| `skipDateFilter` | Set `true` to exclude this query from date range filtering |

### Chart types

- **area** — filled area chart, good for time series
- **bar** — vertical grouped bars, good for comparing categories over time
- **horizontal-bar** — horizontal bars, good for top-N rankings
- **line** — line chart, good for trends and rates
- **pie** — donut chart, good for proportional breakdowns

### Date filtering

The toolbar provides From/To date pickers. When the user clicks Apply, all queries (except those with `skipDateFilter: true`) get a WHERE clause injected using the `dateExpression` from your config. Queries must use the dedup CTE pattern (`)\nSELECT` boundary) for injection to work.

### Dedup CTE

RawTree connectors may insert multiple versions of the same document (CDC updates). The dedup CTE keeps only the latest version per `dedupIdColumn`, ordered by `dedupTsColumn` descending. All chart queries should use this CTE to avoid counting duplicates. Use `buildDedupCte(config)` to generate it from your dashboard config.
