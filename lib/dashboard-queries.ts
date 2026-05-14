import type { DashboardQuery, DashboardConfig } from "@/lib/types";

export function buildDedupCte(config: DashboardConfig): string {
  return `WITH events AS (
  SELECT * FROM (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY ${config.dedupIdColumn}
        ORDER BY ${config.dedupTsColumn} DESC
      ) AS _rn
    FROM ${config.table}
  ) WHERE _rn = 1
)`;
}

export function buildDateRangeQuery(config: DashboardConfig): string {
  return `SELECT
    min(${config.dateExpression}) AS min_date,
    max(${config.dateExpression}) AS max_date
FROM ${config.table}`;
}

export function buildStatsQuery(config: DashboardConfig): string {
  const expressions = config.stats.map((s) => s.sqlExpression).join(",\n    ");
  return `${buildDedupCte(config)}
SELECT
    ${expressions}
FROM events`;
}

const ISO_DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Ensures value is a real calendar day YYYY-MM-DD with no extra characters (safe as a quoted SQL literal). */
function assertSqlDateLiteral(value: string, label: string): void {
  if (!ISO_DATE_ONLY.test(value)) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  const y = Number(value.slice(0, 4));
  const mo = Number(value.slice(5, 7));
  const d = Number(value.slice(8, 10));
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (
    dt.getUTCFullYear() !== y ||
    dt.getUTCMonth() !== mo - 1 ||
    dt.getUTCDate() !== d
  ) {
    throw new Error(`Invalid calendar date for ${label}`);
  }
}

export function injectDateFilter(
  sql: string,
  dateFrom: string,
  dateTo: string,
  dateExpression: string
): string {
  assertSqlDateLiteral(dateFrom, "dateFrom");
  assertSqlDateLiteral(dateTo, "dateTo");

  const condition = `${dateExpression} >= '${dateFrom}' AND ${dateExpression} <= '${dateTo} 23:59:59'`;

  const cteEnd = sql.indexOf(")\nSELECT");
  if (cteEnd === -1) return sql;

  const outerQuery = sql.slice(cteEnd + 1);
  const prefix = sql.slice(0, cteEnd + 1);

  const whereMatch = outerQuery.match(
    /\bWHERE\b([\s\S]*?)(?=\bGROUP\b|\bORDER\b|\bLIMIT\b|$)/i
  );
  if (whereMatch) {
    const injected = outerQuery.replace(
      /\bWHERE\b/i,
      `WHERE ${condition}\n  AND`
    );
    return prefix + injected;
  }

  const insertBefore = outerQuery.match(/\b(GROUP|ORDER|LIMIT)\b/i);
  if (insertBefore && insertBefore.index !== undefined) {
    const before = outerQuery.slice(0, insertBefore.index);
    const after = outerQuery.slice(insertBefore.index);
    return prefix + before + `WHERE ${condition}\n` + after;
  }

  return prefix + outerQuery + `\nWHERE ${condition}`;
}

const GH_ARCHIVE_DEDUP_CTE = buildDedupCte({
  table: "mongo_events",
  dateExpression: "parseDateTime64BestEffort(toString(_rt_doc.created_at))",
  dedupIdColumn: "_rt_id",
  dedupTsColumn: "_rt_ts",
  stats: [],
});

export const ghArchiveQueries: DashboardQuery[] = [
  {
    id: "events-over-time",
    title: "Events Over Time",
    description: "Event count per 10-minute bucket",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toStartOfTenMinutes(
        parseDateTime64BestEffort(toString(_rt_doc.created_at))
    ) AS bucket,
    count() AS events
FROM events
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["events"],
      colors: ["var(--color-primary)"],
    },
  },
  {
    id: "events-by-type",
    title: "Events by Type",
    description: "Distribution of GitHub event types",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toString(_rt_doc.type) AS event_type,
    count() AS cnt
FROM events
GROUP BY event_type
ORDER BY cnt DESC
LIMIT 15`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "cnt",
      yKeys: ["event_type"],
      colors: ["var(--color-primary)"],
    },
  },
  {
    id: "event-type-breakdown",
    title: "Event Type Breakdown",
    description: "Percentage distribution of event types",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toString(_rt_doc.type) AS event_type,
    count() AS cnt
FROM events
GROUP BY event_type
ORDER BY cnt DESC
LIMIT 10`,
    chartType: "pie",
    chartConfig: {
      xKey: "cnt",
      yKeys: ["event_type"],
    },
  },
  {
    id: "top-repos",
    title: "Top 10 Repositories",
    description: "Most active repositories by event count",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toString(_rt_doc.repo.name) AS repo,
    count() AS events
FROM events
GROUP BY repo
ORDER BY events DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "events",
      yKeys: ["repo"],
      colors: ["var(--color-chart-3)"],
    },
  },
  {
    id: "top-contributors",
    title: "Top 10 Contributors",
    description: "Most active users by event count",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toString(_rt_doc.actor.login) AS actor,
    count() AS events
FROM events
GROUP BY actor
ORDER BY events DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "events",
      yKeys: ["actor"],
      colors: ["var(--color-chart-2)"],
    },
  },
  {
    id: "stargazers-activity",
    title: "Star Gazers Activity",
    description: "WatchEvent (starring) activity over time",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toStartOfTenMinutes(
        parseDateTime64BestEffort(toString(_rt_doc.created_at))
    ) AS bucket,
    count() AS stars
FROM events
WHERE toString(_rt_doc.type) = 'WatchEvent'
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["stars"],
      colors: ["oklch(0.7 0.18 85)"],
    },
  },
  {
    id: "pr-issue-activity",
    title: "PR & Issue Activity",
    description: "Pull requests and issues over time",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toStartOfTenMinutes(
        parseDateTime64BestEffort(toString(_rt_doc.created_at))
    ) AS bucket,
    countIf(toString(_rt_doc.type) = 'PullRequestEvent') AS pull_requests,
    countIf(toString(_rt_doc.type) = 'IssuesEvent') AS issues
FROM events
GROUP BY bucket
ORDER BY bucket`,
    chartType: "bar",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["pull_requests", "issues"],
      colors: ["var(--color-primary)", "oklch(0.65 0.18 150)"],
    },
  },
  {
    id: "push-sizes",
    title: "Push Event Sizes",
    description: "Average commits per push over time",
    sql: `${GH_ARCHIVE_DEDUP_CTE}
SELECT
    toStartOfTenMinutes(
        parseDateTime64BestEffort(toString(_rt_doc.created_at))
    ) AS bucket,
    avg(toFloat64OrZero(toString(_rt_doc.payload.size))) AS avg_commits,
    count() AS pushes
FROM events
WHERE toString(_rt_doc.type) = 'PushEvent'
GROUP BY bucket
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["avg_commits"],
      colors: ["oklch(0.65 0.15 30)"],
    },
  },
  {
    id: "ingestion-throughput",
    title: "Ingestion Throughput",
    description: "Documents ingested per minute (last hour)",
    sql: `SELECT
    toStartOfMinute(inserted_at) AS minute,
    count() AS docs
FROM mongo_events
WHERE inserted_at >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute`,
    chartType: "area",
    chartConfig: {
      xKey: "minute",
      yKeys: ["docs"],
      colors: ["oklch(0.6 0.2 160)"],
    },
    skipDateFilter: true,
  },
];
