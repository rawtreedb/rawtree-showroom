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

// ---------------------------------------------------------------------------
// CloudFront + WAF Security Dashboard
// ---------------------------------------------------------------------------

const WAF_CTE = `WITH events AS (
  SELECT *,
    toString(\`labels\`) AS labels_str,
    toString(\`ruleGroupList\`) AS ruleGroupList_str
  FROM waf_logs
)`;

export const wafSecurityQueries: DashboardQuery[] = [
  // Row 1 — two half-width panels side by side
  {
    id: "waf-requests-over-time",
    title: "Requests Over Time: Allow vs Block",
    description: "WAF allow/block decisions per 5-minute bucket",
    sql: `${WAF_CTE}
SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(\`timestamp\`))) AS bucket,
    countIf(\`action\` = 'ALLOW') AS allowed,
    countIf(\`action\` = 'BLOCK') AS blocked
FROM events
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["allowed", "blocked"],
      colors: ["oklch(0.65 0.18 150)", "oklch(0.6 0.22 25)"],
    },
    colSpan: 2,
    showLegend: true,
  },
  {
    id: "waf-blocks-by-uri",
    title: "Blocked Requests by URI",
    description: "Time series of blocked requests per request URI",
    sql: `${WAF_CTE}
SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(\`timestamp\`))) AS bucket,
    toString(\`httpRequest.uri\`) AS uri,
    count() AS blocks
FROM events
WHERE \`action\` = 'BLOCK'
GROUP BY bucket, uri
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["blocks"],
      colors: [
        "oklch(0.6 0.22 25)",
        "oklch(0.55 0.2 280)",
        "oklch(0.7 0.18 85)",
        "oklch(0.65 0.18 150)",
        "oklch(0.65 0.15 30)",
        "oklch(0.6 0.2 265)",
        "oklch(0.7 0.12 220)",
        "oklch(0.55 0.2 330)",
      ],
    },
    groupKey: "uri",
    colSpan: 2,
    showLegend: true,
  },

  // Row 2 — map (1/3) + attack types (2/3)
  {
    id: "waf-request-locations",
    title: "Request Locations",
    description: "Request origin location by country",
    sql: `${WAF_CTE}
SELECT
    toString(\`httpRequest.country\`) AS country,
    count() AS requests
FROM events
GROUP BY country
ORDER BY requests DESC
LIMIT 30`,
    chartType: "world-map",
    chartConfig: {
      xKey: "requests",
      yKeys: ["country"],
      colors: ["#3b82f6"],
    },
    chartHeight: 260,
  },
  {
    id: "waf-attack-types",
    title: "Attack Types",
    description: "Types of attacks identified in blocked requests",
    sql: `SELECT
    arrayElement(
      splitByChar(':', JSONExtractString(lbl, 'name')),
      -1
    ) AS attack_type,
    count() AS requests
FROM waf_logs
ARRAY JOIN JSONExtractArrayRaw(ifNull(toJSONString(\`labels\`), '[]')) AS lbl
WHERE \`action\` = 'BLOCK'
  AND JSONExtractString(lbl, 'name') != ''
GROUP BY attack_type
ORDER BY requests DESC
LIMIT 10`,
    skipDateFilter: true,
    chartType: "bar",
    chartConfig: {
      xKey: "attack_type",
      yKeys: ["requests"],
      colors: [
        "oklch(0.6 0.2 265)",
        "oklch(0.6 0.22 25)",
        "oklch(0.65 0.18 150)",
        "oklch(0.55 0.2 280)",
        "oklch(0.7 0.18 85)",
        "oklch(0.65 0.15 30)",
      ],
    },
    colSpan: 4,
    chartHeight: 260,
    showLegend: true,
  },

  // Row 3 — three equal panels
  {
    id: "waf-block-rate",
    title: "Block Rate Over Time",
    description: "Percentage of requests blocked per 5-minute bucket",
    sql: `${WAF_CTE}
SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(\`timestamp\`))) AS bucket,
    round(countIf(\`action\` = 'BLOCK') * 100.0 / count(), 1) AS block_rate
FROM events
GROUP BY bucket
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["block_rate"],
      colors: ["oklch(0.6 0.22 25)"],
    },
  },
  {
    id: "waf-top-blocked-ips",
    title: "Top 10 Blocked IPs",
    description: "Source IPs with the most blocked requests",
    sql: `${WAF_CTE}
SELECT
    toString(\`httpRequest.clientIp\`) AS ip,
    count() AS blocks
FROM events
WHERE \`action\` = 'BLOCK'
GROUP BY ip
ORDER BY blocks DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "blocks",
      yKeys: ["ip"],
      colors: ["oklch(0.6 0.22 25)"],
    },
  },
  {
    id: "waf-top-rules",
    title: "Top Terminating Rules",
    description: "WAF rules that blocked the most requests",
    sql: `${WAF_CTE}
SELECT
    toString(\`terminatingRuleId\`) AS rule_id,
    count() AS blocks
FROM events
WHERE \`action\` = 'BLOCK'
GROUP BY rule_id
ORDER BY blocks DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "blocks",
      yKeys: ["rule_id"],
      colors: ["oklch(0.55 0.2 280)"],
    },
  },

  // Row 3 — three equal panels
  {
    id: "waf-attack-categories",
    title: "Attack Categories",
    description: "Attack labels from WAF managed rules",
    sql: `SELECT
    arrayElement(
      splitByChar(':', JSONExtractString(lbl, 'name')),
      -1
    ) AS label_name,
    count() AS cnt
FROM waf_logs
ARRAY JOIN JSONExtractArrayRaw(ifNull(toJSONString(\`labels\`), '[]')) AS lbl
WHERE \`action\` = 'BLOCK'
  AND JSONExtractString(lbl, 'name') != ''
GROUP BY label_name
ORDER BY cnt DESC
LIMIT 10`,
    skipDateFilter: true,
    chartType: "pie",
    chartConfig: {
      xKey: "cnt",
      yKeys: ["label_name"],
    },
  },
  {
    id: "waf-top-blocked-uris",
    title: "Top Blocked URIs",
    description: "Most frequently blocked request paths",
    sql: `${WAF_CTE}
SELECT
    toString(\`httpRequest.uri\`) AS uri,
    count() AS blocks
FROM events
WHERE \`action\` = 'BLOCK'
GROUP BY uri
ORDER BY blocks DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "blocks",
      yKeys: ["uri"],
      colors: ["oklch(0.65 0.15 30)"],
    },
  },
  {
    id: "waf-top-countries",
    title: "Top Countries by Blocks",
    description: "Countries originating the most blocked requests",
    sql: `${WAF_CTE}
SELECT
    toString(\`httpRequest.country\`) AS country,
    count() AS blocks
FROM events
WHERE \`action\` = 'BLOCK'
GROUP BY country
ORDER BY blocks DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "blocks",
      yKeys: ["country"],
      colors: ["oklch(0.7 0.18 85)"],
    },
  },

  // Row 4 — status codes (1/2) + request latency (1/2)
  {
    id: "cf-status-codes",
    title: "Status Code Distribution Over Time",
    description: "HTTP response status codes from CloudFront edge",
    sql: `SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(toFloat64OrZero(toString(\`timestamp\`)) * 1000))) AS bucket,
    countIf(toInt32OrZero(toString(\`sc-status\`)) >= 200 AND toInt32OrZero(toString(\`sc-status\`)) < 300) AS s2xx,
    countIf(toInt32OrZero(toString(\`sc-status\`)) >= 300 AND toInt32OrZero(toString(\`sc-status\`)) < 400) AS s3xx,
    countIf(toInt32OrZero(toString(\`sc-status\`)) >= 400 AND toInt32OrZero(toString(\`sc-status\`)) < 500) AS s4xx,
    countIf(toInt32OrZero(toString(\`sc-status\`)) >= 500) AS s5xx
FROM cloudfront_logs
GROUP BY bucket
ORDER BY bucket`,
    chartType: "bar",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["s2xx", "s3xx", "s4xx", "s5xx"],
      colors: [
        "oklch(0.65 0.18 150)",
        "oklch(0.7 0.12 220)",
        "oklch(0.7 0.18 85)",
        "oklch(0.6 0.22 25)",
      ],
    },
    skipDateFilter: true,
    colSpan: 2,
    stacked: true,
    showLegend: true,
  },
  {
    id: "cf-request-latency",
    title: "Request Latency",
    description: "P50 / P90 / P99 of time-taken per 5-minute bucket",
    sql: `SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(toFloat64OrZero(toString(\`timestamp\`)) * 1000))) AS bucket,
    quantile(0.5)(toFloat64OrZero(toString(\`time-taken\`))) AS p50,
    quantile(0.9)(toFloat64OrZero(toString(\`time-taken\`))) AS p90,
    quantile(0.99)(toFloat64OrZero(toString(\`time-taken\`))) AS p99
FROM cloudfront_logs
GROUP BY bucket
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["p50", "p90", "p99"],
      colors: ["oklch(0.65 0.18 150)", "oklch(0.7 0.18 85)", "oklch(0.6 0.22 25)"],
    },
    skipDateFilter: true,
    colSpan: 2,
    showLegend: true,
  },

  // Row 5 — three equal panels (CloudFront)
  {
    id: "cf-cache-hit-ratio",
    title: "Cache Hit Ratio Over Time",
    description: "Percentage of requests served from CloudFront cache",
    sql: `SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(toFloat64OrZero(toString(\`timestamp\`)) * 1000))) AS bucket,
    round(countIf(toString(\`x-edge-result-type\`) = 'Hit') * 100.0 / count(), 1) AS hit_ratio
FROM cloudfront_logs
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["hit_ratio"],
      colors: ["oklch(0.65 0.18 150)"],
    },
    skipDateFilter: true,
  },
  {
    id: "cf-latency",
    title: "Origin Latency (TTFB)",
    description: "Time-to-first-byte p50 / p95 / p99 per 5-minute bucket",
    sql: `SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(toFloat64OrZero(toString(\`timestamp\`)) * 1000))) AS bucket,
    quantile(0.5)(toFloat64OrZero(toString(\`time-to-first-byte\`))) AS p50,
    quantile(0.95)(toFloat64OrZero(toString(\`time-to-first-byte\`))) AS p95,
    quantile(0.99)(toFloat64OrZero(toString(\`time-to-first-byte\`))) AS p99
FROM cloudfront_logs
GROUP BY bucket
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["p50", "p95", "p99"],
      colors: ["oklch(0.65 0.18 150)", "oklch(0.7 0.18 85)", "oklch(0.6 0.22 25)"],
    },
    skipDateFilter: true,
  },
  {
    id: "cf-bandwidth",
    title: "Bandwidth Over Time",
    description: "Bytes served from CloudFront edge per 5-minute bucket",
    sql: `SELECT
    toStartOfFiveMinutes(fromUnixTimestamp64Milli(toInt64(toFloat64OrZero(toString(\`timestamp\`)) * 1000))) AS bucket,
    sum(toFloat64OrZero(toString(\`sc-bytes\`))) AS bytes_out
FROM cloudfront_logs
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["bytes_out"],
      colors: ["oklch(0.6 0.2 265)"],
    },
    skipDateFilter: true,
  },

  // Row 6 — three equal panels (mixed)
  {
    id: "cf-top-paths",
    title: "Top Paths by Requests",
    description: "Most requested URI paths via CloudFront",
    sql: `SELECT
    toString(\`cs-uri-stem\`) AS path,
    count() AS requests
FROM cloudfront_logs
GROUP BY path
ORDER BY requests DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "requests",
      yKeys: ["path"],
      colors: ["oklch(0.6 0.2 265)"],
    },
    skipDateFilter: true,
  },
  {
    id: "cf-edge-locations",
    title: "Edge Location Distribution",
    description: "CloudFront edge locations serving the most requests",
    sql: `SELECT
    toString(\`x-edge-location\`) AS edge,
    count() AS requests
FROM cloudfront_logs
GROUP BY edge
ORDER BY requests DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "requests",
      yKeys: ["edge"],
      colors: ["oklch(0.7 0.12 220)"],
    },
    skipDateFilter: true,
  },
  {
    id: "waf-http-methods",
    title: "HTTP Method Distribution",
    description: "Breakdown of HTTP methods in WAF-inspected traffic",
    sql: `${WAF_CTE}
SELECT
    toString(\`httpRequest.httpMethod\`) AS method,
    count() AS cnt
FROM events
GROUP BY method
ORDER BY cnt DESC
LIMIT 10`,
    chartType: "pie",
    chartConfig: {
      xKey: "cnt",
      yKeys: ["method"],
    },
  },
];
