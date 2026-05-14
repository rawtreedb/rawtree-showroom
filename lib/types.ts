export interface ArchitectureNode {
  id: string;
  label: string;
  type: "source" | "database" | "connector" | "platform" | "dashboard" | "script";
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
  chartType: "area" | "bar" | "horizontal-bar" | "line" | "pie";
  chartConfig: {
    xKey: string;
    yKeys: string[];
    colors?: string[];
  };
  skipDateFilter?: boolean;
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
