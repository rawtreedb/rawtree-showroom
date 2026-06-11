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

// ---------------------------------------------------------------------------
// Supabase Superstore CDC Dashboard
// ---------------------------------------------------------------------------

const SUPERSTORE_TABLE = "public_superstore__sales__data";

// Converts Postgres LSN text such as '1/F20001D8' into a sortable integer and
// pairs it with the transaction ordinal, so CDC events for the same source row
// can be ordered. Mirrors the query pattern documented in the supabase-etl
// example README (rawtreedb/examples → postgres/supabase-etl).
const SUPERSTORE_EVENT_ORDER = `tuple(
          reinterpretAsUInt64(reverse(unhex(concat(
            leftPad(splitByChar('/', toString(_etl_commit_lsn))[1], 8, '0'),
            leftPad(splitByChar('/', toString(_etl_commit_lsn))[2], 8, '0')
          )))),
          toUInt64OrZero(toString(_etl_tx_ordinal))
        )`;

// The source dataset stores dates as DD/MM/YYYY text.
const SUPERSTORE_ORDER_DATE =
  "parseDateTimeOrNull(toString(`Order Date`), '%d/%m/%Y')";
const SUPERSTORE_SHIP_DATE =
  "parseDateTimeOrNull(toString(`Ship Date`), '%d/%m/%Y')";
const SUPERSTORE_SALES = "toFloat64OrZero(toString(`Sales`))";

// Reconstructs the current table state from the append-only CDC event log:
// keep only row-level events, take the latest event per primary key, and drop
// keys whose latest event is a delete.
const SUPERSTORE_CTE = `WITH events AS (
  SELECT * FROM (
    SELECT *,
      ROW_NUMBER() OVER (
        PARTITION BY toString(\`Row ID\`)
        ORDER BY ${SUPERSTORE_EVENT_ORDER} DESC
      ) AS _rn
    FROM ${SUPERSTORE_TABLE}
    WHERE toString(_etl_op) IN ('copy', 'insert', 'update', 'delete')
  ) WHERE _rn = 1 AND toString(_etl_op) != 'delete'
)`;

export const supabaseSuperstoreQueries: DashboardQuery[] = [
  // Row 1 — two half-width time series (Part 2 of the Kaggle notebook)
  {
    id: "superstore-monthly-sales",
    title: "Monthly Sales Trend",
    description: "Total revenue per month across the order history",
    sql: `${SUPERSTORE_CTE}
SELECT
    toStartOfMonth(${SUPERSTORE_ORDER_DATE}) AS bucket,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY bucket
ORDER BY bucket`,
    chartType: "area",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["sales"],
      colors: ["var(--color-primary)"],
    },
    colSpan: 2,
  },
  {
    id: "superstore-monthly-sales-by-category",
    title: "Monthly Sales by Category",
    description: "Revenue trend per product category",
    sql: `${SUPERSTORE_CTE}
SELECT
    toStartOfMonth(${SUPERSTORE_ORDER_DATE}) AS bucket,
    toString(\`Category\`) AS category,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY bucket, category
ORDER BY bucket`,
    chartType: "line",
    chartConfig: {
      xKey: "bucket",
      yKeys: ["sales"],
      colors: [
        "oklch(0.6 0.2 265)",
        "oklch(0.65 0.18 150)",
        "oklch(0.7 0.18 85)",
      ],
    },
    groupKey: "category",
    colSpan: 2,
    showLegend: true,
  },

  // Row 2 — customer analysis
  {
    id: "superstore-sales-by-segment",
    title: "Sales by Customer Segment",
    description: "Revenue share of Consumer, Corporate, and Home Office",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Segment\`) AS segment,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY segment
ORDER BY sales DESC`,
    chartType: "pie",
    chartConfig: {
      xKey: "sales",
      yKeys: ["segment"],
    },
  },
  {
    id: "superstore-top-customers-by-sales",
    title: "Top 10 Customers by Sales",
    description: "Customers generating the most revenue",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Customer Name\`) AS customer,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY customer
ORDER BY sales DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "sales",
      yKeys: ["customer"],
      colors: ["var(--color-primary)"],
    },
  },
  {
    id: "superstore-top-customers-by-orders",
    title: "Top 10 Frequent Customers",
    description: "Customers who placed the most orders",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Customer Name\`) AS customer,
    uniq(toString(\`Order ID\`)::String) AS orders
FROM events
GROUP BY customer
ORDER BY orders DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "orders",
      yKeys: ["customer"],
      colors: ["oklch(0.6 0.2 265)"],
    },
  },

  // Row 3 — geographic analysis
  {
    id: "superstore-sales-by-region",
    title: "Sales by Region",
    description: "Revenue share across the four US regions",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Region\`) AS region,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY region
ORDER BY sales DESC`,
    chartType: "pie",
    chartConfig: {
      xKey: "sales",
      yKeys: ["region"],
    },
  },
  {
    id: "superstore-top-states",
    title: "Top 10 States by Sales",
    description: "States generating the most revenue",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`State\`) AS state,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY state
ORDER BY sales DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "sales",
      yKeys: ["state"],
      colors: ["oklch(0.65 0.18 150)"],
    },
  },
  {
    id: "superstore-top-cities",
    title: "Top 10 Cities by Sales",
    description: "Cities generating the most revenue",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`City\`) AS city,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY city
ORDER BY sales DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "sales",
      yKeys: ["city"],
      colors: ["oklch(0.7 0.12 220)"],
    },
  },

  // Row 4 — product analysis
  {
    id: "superstore-sales-by-category",
    title: "Sales by Category",
    description: "Revenue share of Furniture, Office Supplies, and Technology",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Category\`) AS category,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY category
ORDER BY sales DESC`,
    chartType: "pie",
    chartConfig: {
      xKey: "sales",
      yKeys: ["category"],
    },
  },
  {
    id: "superstore-sales-by-subcategory",
    title: "Sales by Sub-Category",
    description: "Revenue across all product sub-categories",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Sub-Category\`) AS subcategory,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY subcategory
ORDER BY sales DESC
LIMIT 17`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "sales",
      yKeys: ["subcategory"],
      colors: ["oklch(0.55 0.2 280)"],
    },
  },
  {
    id: "superstore-top-products",
    title: "Top 10 Products by Sales",
    description: "Best-selling products by revenue",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Product Name\`) AS product,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY product
ORDER BY sales DESC
LIMIT 10`,
    chartType: "horizontal-bar",
    chartConfig: {
      xKey: "sales",
      yKeys: ["product"],
      colors: ["oklch(0.65 0.15 30)"],
    },
  },

  // Row 5 — shipping & seasonality
  {
    id: "superstore-ship-mode",
    title: "Ship Mode Distribution",
    description: "Order lines per shipping mode",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Ship Mode\`) AS ship_mode,
    count() AS order_lines
FROM events
GROUP BY ship_mode
ORDER BY order_lines DESC`,
    chartType: "pie",
    chartConfig: {
      xKey: "order_lines",
      yKeys: ["ship_mode"],
    },
  },
  {
    id: "superstore-shipping-delay",
    title: "Shipping Delay by Mode",
    description: "Average days between order date and ship date",
    sql: `${SUPERSTORE_CTE}
SELECT
    toString(\`Ship Mode\`) AS ship_mode,
    round(avg(dateDiff('day', ${SUPERSTORE_ORDER_DATE}, ${SUPERSTORE_SHIP_DATE})), 1) AS avg_days
FROM events
GROUP BY ship_mode
ORDER BY avg_days DESC`,
    chartType: "bar",
    chartConfig: {
      xKey: "ship_mode",
      yKeys: ["avg_days"],
      colors: ["oklch(0.7 0.18 85)"],
    },
  },
  {
    id: "superstore-seasonality",
    title: "Sales Seasonality",
    description: "Total revenue per calendar month across all years",
    sql: `${SUPERSTORE_CTE}
SELECT
    toMonth(${SUPERSTORE_ORDER_DATE}) AS month_num,
    arrayElement(
      ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
      toInt32(toMonth(${SUPERSTORE_ORDER_DATE}))
    ) AS month,
    round(sum(${SUPERSTORE_SALES})) AS sales
FROM events
GROUP BY month_num, month
ORDER BY month_num`,
    chartType: "bar",
    chartConfig: {
      xKey: "month",
      yKeys: ["sales"],
      colors: ["oklch(0.6 0.2 160)"],
    },
  },

  // Row 6 — CDC pipeline health
  {
    id: "superstore-cdc-operations",
    title: "CDC Operations",
    description: "Insert / update / delete events per minute (last hour)",
    sql: `SELECT
    toStartOfMinute(inserted_at) AS minute,
    countIf(toString(_etl_op) = 'insert') AS inserts,
    countIf(toString(_etl_op) = 'update') AS updates,
    countIf(toString(_etl_op) = 'delete') AS deletes
FROM ${SUPERSTORE_TABLE}
WHERE inserted_at >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute`,
    chartType: "bar",
    chartConfig: {
      xKey: "minute",
      yKeys: ["inserts", "updates", "deletes"],
      colors: [
        "oklch(0.65 0.18 150)",
        "oklch(0.7 0.18 85)",
        "oklch(0.6 0.22 25)",
      ],
    },
    skipDateFilter: true,
    stacked: true,
    showLegend: true,
  },
  {
    id: "superstore-cdc-op-breakdown",
    title: "CDC Event Types",
    description: "All-time distribution of CDC operations in the event log",
    sql: `SELECT
    toString(_etl_op) AS op,
    count() AS cnt
FROM ${SUPERSTORE_TABLE}
WHERE toString(_etl_op) IN ('copy', 'insert', 'update', 'delete')
GROUP BY op
ORDER BY cnt DESC`,
    chartType: "pie",
    chartConfig: {
      xKey: "cnt",
      yKeys: ["op"],
    },
    skipDateFilter: true,
  },
  {
    id: "superstore-ingestion-throughput",
    title: "Ingestion Throughput",
    description: "CDC events ingested per minute (last hour)",
    sql: `SELECT
    toStartOfMinute(inserted_at) AS minute,
    count() AS events
FROM ${SUPERSTORE_TABLE}
WHERE inserted_at >= now() - INTERVAL 1 HOUR
GROUP BY minute
ORDER BY minute`,
    chartType: "area",
    chartConfig: {
      xKey: "minute",
      yKeys: ["events"],
      colors: ["oklch(0.6 0.2 160)"],
    },
    skipDateFilter: true,
  },
];
