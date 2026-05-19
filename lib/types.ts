export interface ArchitectureNode {
  id: string;
  label: string;
  type: "source" | "database" | "connector" | "platform" | "dashboard" | "script" | "firewall";
  description?: string;
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  label?: string;
}

export interface SetupStep {
  title: string;
  content: string;
  codeBlock?: { language: string; code: string };
  notice?: { text: string; link?: { label: string; url: string } };
}

export interface SetupGuide {
  method: string;
  steps: SetupStep[];
  comingSoonMessage?: string;
}

export interface DashboardStat {
  label: string;
  sqlExpression: string;
  key: string;
}

export interface DashboardConfig {
  table: string;
  dateExpression: string;
  dedupIdColumn: string;
  dedupTsColumn: string;
  stats: DashboardStat[];
}

export interface DashboardQuery {
  id: string;
  title: string;
  description: string;
  sql: string;
  chartType: "area" | "bar" | "horizontal-bar" | "line" | "pie" | "world-map";
  chartConfig: {
    xKey: string;
    yKeys: string[];
    colors?: string[];
  };
  skipDateFilter?: boolean;
  colSpan?: 1 | 2 | 3 | 4;
  /** When set, pivots rows (xKey, groupKey, yKeys[0]) into one series per unique groupKey value. */
  groupKey?: string;
  /** Show a legend on the right side of the chart. */
  showLegend?: boolean;
  /** Override the default chart height in pixels (default 200). */
  chartHeight?: number;
  /** Stack bars instead of grouping them side by side. */
  stacked?: boolean;
}

export interface UseCase {
  slug: string;
  title: string;
  shortDescription: string;
  description: string;
  tags: string[];
  category: string;
  heroImage: string;
  repos: { name: string; url: string }[];
  architecture: {
    nodes: ArchitectureNode[];
    edges: ArchitectureEdge[];
  };
  dashboardConfig: DashboardConfig;
  dashboardQueries: DashboardQuery[];
  setupGuides: SetupGuide[];
  publishedAt: string;
}
