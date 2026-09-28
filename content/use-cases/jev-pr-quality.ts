import type { UseCase } from "@/lib/types";
import { buildDedupCte } from "@/lib/dashboard-queries";

const dashboardConfig = {
  table: "jev_pr_reviews",
  dateExpression: "parseDateTime64BestEffort(recorded_at)",
  dedupIdColumn: "concat(repository, ':', toString(pr_number))",
  dedupTsColumn:
    "tuple(parseDateTime64BestEffort(recorded_at), ifNull(run_id, 0), ifNull(run_attempt, 0))",
  stats: [
    {
      label: "Reviewed PRs",
      sqlExpression: "count() AS reviewed_prs",
      key: "reviewed_prs",
    },
    {
      label: "Contributors",
      sqlExpression: "uniq(author_login) AS contributors",
      key: "contributors",
    },
    {
      label: "Avg. Minimum Score",
      sqlExpression: "round(avg(minimum_score), 2) AS average_minimum_score",
      key: "average_minimum_score",
    },
    {
      label: "Pass Rate",
      sqlExpression: "round(100 * avg(if(passed, 1, 0)), 1) AS pass_rate",
      key: "pass_rate",
    },
  ],
};

const CTE = buildDedupCte(dashboardConfig);

export const jevPrQuality: UseCase = {
  slug: "jev-pr-quality",
  title: "AI-Assisted Pull Request Quality",
  shortDescription:
    "Evaluate pull requests with Jev, store structured quality ratings in RawTree, and track team-level trends.",
  description:
    "A GitHub Actions workflow sends each complete pull-request diff to Jev for structured evaluation across 19 software-quality dimensions. RawTree stores every completed run as an append-only event, making it possible to compare the latest result for each PR, inspect pass rates, and follow quality trends without treating the model as a replacement for tests or human review. Demo rows use real pull-request metadata with explicitly synthetic scores.",
  tags: ["GitHub Actions", "AI Evaluation", "Developer Experience", "CI/CD"],
  category: "AI Engineering",
  heroImage: "/use-cases/jev-pr-quality/thumbnail.png",
  repos: [
    {
      name: "rawtree-platform",
      url: "https://github.com/rawtreedb/rawtree-platform",
    },
  ],
  architecture: {
    nodes: [
      {
        id: "github",
        label: "GitHub PR",
        type: "source",
        description: "Title, description & complete diff",
      },
      {
        id: "jev",
        label: "Jev Review",
        type: "script",
        description: "19 typed quality ratings",
      },
      {
        id: "rawtree",
        label: "RawTree",
        type: "platform",
        description: "Append-only review events",
      },
      {
        id: "dashboard",
        label: "Quality Dashboard",
        type: "dashboard",
        description: "Latest score per pull request",
      },
    ],
    edges: [
      { from: "github", to: "jev", label: "GitHub Actions" },
      { from: "jev", to: "rawtree", label: "HTTP insert" },
      { from: "rawtree", to: "dashboard", label: "SQL" },
    ],
  },
  dashboardConfig,
  dashboardQueries: [
    {
      id: "contributor-leaderboard",
      title: "Contributor Quality Score",
      description: "Average of each contributor's minimum applicable PR score",
      sql: `${CTE}
SELECT
  author_login AS author,
  round(avg(minimum_score), 2) AS quality_score,
  count() AS reviewed_prs,
  round(100 * avg(if(passed, 1, 0)), 1) AS pass_rate
FROM events
GROUP BY author
ORDER BY quality_score DESC, pass_rate DESC, reviewed_prs DESC
LIMIT 10`,
      chartType: "horizontal-bar",
      chartConfig: {
        xKey: "quality_score",
        yKeys: ["author"],
        colors: ["oklch(0.62 0.2 255)"],
      },
      colSpan: 2,
      chartHeight: 260,
    },
    {
      id: "quality-over-time",
      title: "Quality Over Time",
      description: "Daily average and lowest minimum PR score",
      sql: `${CTE}
SELECT
  toDate(parseDateTime64BestEffort(recorded_at)) AS day,
  round(avg(minimum_score), 2) AS average_score,
  round(min(minimum_score), 2) AS lowest_score
FROM events
GROUP BY day
ORDER BY day`,
      chartType: "line",
      chartConfig: {
        xKey: "day",
        yKeys: ["average_score", "lowest_score"],
        colors: ["oklch(0.62 0.2 255)", "oklch(0.7 0.17 40)"],
      },
      showLegend: true,
      colSpan: 2,
      chartHeight: 260,
    },
    {
      id: "review-outcomes",
      title: "Review Outcomes",
      description: "Latest passing and below-threshold PR results",
      sql: `${CTE}
SELECT
  if(passed, 'Passed', 'Below threshold') AS outcome,
  count() AS reviews
FROM events
GROUP BY outcome
ORDER BY reviews DESC`,
      chartType: "horizontal-bar",
      chartConfig: {
        xKey: "reviews",
        yKeys: ["outcome"],
        colors: ["oklch(0.62 0.2 255)"],
      },
      colSpan: 2,
      chartHeight: 240,
    },
    {
      id: "reviews-by-contributor",
      title: "Reviews by Contributor",
      description: "Number of latest PR evaluations represented",
      sql: `${CTE}
SELECT
  author_login AS author,
  count() AS reviews
FROM events
GROUP BY author
ORDER BY reviews DESC
LIMIT 10`,
      chartType: "bar",
      chartConfig: {
        xKey: "author",
        yKeys: ["reviews"],
        colors: ["oklch(0.68 0.16 150)"],
      },
      colSpan: 2,
      chartHeight: 240,
    },
  ],
  setupGuides: [
    {
      method: "GitHub Actions",
      steps: [
        {
          title: "Add the Jev review workflow",
          content:
            "Run Jev against the complete pull-request diff and retain its structured JSON report. Keep the reviewer advisory until its behavior is understood on your repository.",
        },
        {
          title: "Create a write-only RawTree key",
          content:
            "Store a dedicated write-only key as RAWTREE_JEV_API_KEY in GitHub Actions. The first review insert creates the jev_pr_reviews table automatically.",
          codeBlock: {
            language: "bash",
            code: "rtree key create --name github-jev-review --permission write_only",
          },
        },
        {
          title: "Seed clearly labeled demo ratings",
          content:
            "Before live reviews accumulate, use recent GitHub PR metadata with deterministic synthetic ratings. Demo rows are labeled synthetic_demo and never presented as real Jev evaluations.",
          codeBlock: {
            language: "bash",
            code: "RAWTREE_JEV_API_KEY=rt_... node scripts/jev-review/seed-demo.mjs --write",
          },
        },
        {
          title: "Open the dashboard",
          content:
            "Connect with a read-only RawTree API key. Dashboard queries collapse reruns to the latest recorded result per repository and PR before calculating team metrics.",
          codeBlock: {
            language: "bash",
            code: "rtree key create --name jev-quality-dashboard --permission read_only",
          },
        },
      ],
    },
  ],
  publishedAt: "2026-09-28",
};
