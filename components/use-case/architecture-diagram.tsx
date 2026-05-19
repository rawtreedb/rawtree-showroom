import { Fragment } from "react";
import type { ArchitectureNode, ArchitectureEdge } from "@/lib/types";
import {
  Globe,
  Database,
  Cable,
  BarChart3,
  LayoutDashboard,
  Terminal,
  Shield,
} from "lucide-react";

const iconMap: Record<string, typeof Globe> = {
  source: Globe,
  database: Database,
  connector: Cable,
  platform: BarChart3,
  dashboard: LayoutDashboard,
  script: Terminal,
  firewall: Shield,
};

const colorMap: Record<string, string> = {
  source: "text-emerald-500",
  database: "text-green-500",
  connector: "text-blue-500",
  platform: "text-primary",
  dashboard: "text-amber-500",
  script: "text-violet-500",
  firewall: "text-red-500",
};

function NodeCard({ node }: { node: ArchitectureNode }) {
  const Icon = iconMap[node.type];
  return (
    <div className="flex flex-col items-center gap-1 w-[72px] md:w-[100px] shrink-0">
      <div className="flex size-10 md:size-12 items-center justify-center rounded-lg border bg-background shadow-sm">
        <Icon className={`size-5 md:size-6 ${colorMap[node.type]}`} />
      </div>
      <span className="text-[10px] md:text-xs font-medium text-center leading-tight">
        {node.label}
      </span>
      {node.description && (
        <span className="text-[8px] md:text-[10px] text-muted-foreground text-center leading-tight hidden sm:block">
          {node.description}
        </span>
      )}
    </div>
  );
}

function AnimatedArrow({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-1 min-w-[40px] flex-1 max-w-[100px]">
      {label && (
        <span className="text-[10px] text-muted-foreground whitespace-nowrap leading-none">
          {label}
        </span>
      )}
      <svg
        className="w-full h-3"
        viewBox="0 0 80 12"
        fill="none"
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          y1="6"
          x2="68"
          y2="6"
          stroke="currentColor"
          className="text-muted-foreground/40"
          strokeWidth="2"
          strokeDasharray="5 3"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="28"
            to="0"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </line>
        <polygon
          points="66,2 74,6 66,10"
          fill="currentColor"
          className="text-muted-foreground"
        />
      </svg>
    </div>
  );
}

function FanOutArrows({
  toCount,
  edges,
}: {
  toCount: number;
  edges: ArchitectureEdge[];
}) {
  const n = toCount;
  const h = 200;
  const w = 100;
  const midY = h / 2;
  const pad = 35;
  const spread = 18;
  const yStarts = Array.from({ length: n }, (_, i) =>
    n === 1 ? midY : midY + (i - (n - 1) / 2) * spread
  );
  const yEnds = Array.from({ length: n }, (_, i) =>
    n === 1 ? midY : pad + (i / (n - 1)) * (h - 2 * pad)
  );

  return (
    <div className="flex items-center justify-center px-1 w-[80px] shrink-0 self-stretch">
      <svg className="w-full h-full" viewBox={`0 0 ${w} ${h}`} fill="none">
        {Array.from({ length: n }, (_, i) => {
          const yFrom = yStarts[i];
          const yTo = yEnds[i];
          const edge = edges[i];
          const t = 0.7;
          const labelX = 50;
          const goingDown = yTo > midY;
          const labelY = yFrom + t * (yTo - yFrom) + (goingDown ? 26 : -16);

          return (
            <g key={i}>
              <line
                x1="6"
                y1={yFrom}
                x2="84"
                y2={yTo}
                stroke="currentColor"
                className="text-muted-foreground/40"
                strokeWidth="3"
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="28"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </line>
              {edge?.label && (
                <text
                  x={labelX}
                  y={labelY}
                  className="fill-muted-foreground"
                  fontSize="15"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
              <polygon
                points={`84,${yTo - 5} 94,${yTo} 84,${yTo + 5}`}
                fill="currentColor"
                className="text-muted-foreground"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FanInArrows({
  fromCount,
  edges,
}: {
  fromCount: number;
  edges: ArchitectureEdge[];
}) {
  const n = fromCount;
  const h = 200;
  const w = 100;
  const midY = h / 2;
  const pad = 35;
  const spread = 18;
  const yPositions = Array.from({ length: n }, (_, i) =>
    n === 1 ? midY : pad + (i / (n - 1)) * (h - 2 * pad)
  );
  const yEnds = Array.from({ length: n }, (_, i) =>
    n === 1 ? midY : midY + (i - (n - 1) / 2) * spread
  );

  return (
    <div className="flex items-center justify-center px-1 w-[80px] shrink-0 self-stretch">
      <svg className="w-full h-full" viewBox={`0 0 ${w} ${h}`} fill="none">
        {Array.from({ length: n }, (_, i) => {
          const edge = edges[i];
          const yFrom = yPositions[i];
          const yTo = yEnds[i];
          const t = 0.3;
          const labelX = 50;
          const goingDown = yFrom < midY;
          const labelY = yFrom + t * (yTo - yFrom) + (goingDown ? -16 : 26);

          return (
            <g key={i}>
              <line
                x1="0"
                y1={yFrom}
                x2="84"
                y2={yTo}
                stroke="currentColor"
                className="text-muted-foreground/40"
                strokeWidth="3"
                strokeDasharray="6 4"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="28"
                  to="0"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </line>
              {edge?.label && (
                <text
                  x={labelX}
                  y={labelY}
                  className="fill-muted-foreground"
                  fontSize="15"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              )}
              <polygon
                points={`84,${yTo - 5} 94,${yTo} 84,${yTo + 5}`}
                fill="currentColor"
                className="text-muted-foreground"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

type Layout =
  | { type: "linear"; chain: ArchitectureNode[] }
  | {
      type: "fan-in";
      fanInSources: ArchitectureNode[];
      fanInEdges: ArchitectureEdge[];
      chain: ArchitectureNode[];
    }
  | {
      type: "parallel";
      prefix: ArchitectureNode[];
      rows: ArchitectureNode[][];
      suffix: ArchitectureNode[];
      fanOutEdges: ArchitectureEdge[];
      fanInEdges: ArchitectureEdge[];
    };

function buildLayout(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
): Layout {
  const inEdges: Record<string, ArchitectureEdge[]> = {};
  const outEdges: Record<string, ArchitectureEdge[]> = {};
  for (const n of nodes) {
    inEdges[n.id] = [];
    outEdges[n.id] = [];
  }
  for (const e of edges) {
    inEdges[e.to].push(e);
    outEdges[e.from].push(e);
  }

  const fanOutNode = nodes.find((n) => outEdges[n.id].length > 1);
  const fanInNode = nodes.find((n) => inEdges[n.id].length > 1);

  if (!fanOutNode && !fanInNode) {
    let current = nodes.find((n) => inEdges[n.id].length === 0)!;
    const chain: ArchitectureNode[] = [current];
    while (outEdges[current.id].length > 0) {
      current = nodes.find((n) => n.id === outEdges[current.id][0].to)!;
      chain.push(current);
    }
    return { type: "linear", chain };
  }

  if (!fanOutNode && fanInNode) {
    const fanInEdgeList = inEdges[fanInNode.id];
    const sourceNodes = fanInEdgeList.map(
      (e) => nodes.find((n) => n.id === e.from)!
    );
    const chain: ArchitectureNode[] = [fanInNode];
    let current = fanInNode;
    while (outEdges[current.id].length > 0) {
      current = nodes.find((n) => n.id === outEdges[current.id][0].to)!;
      chain.push(current);
    }
    return {
      type: "fan-in",
      fanInSources: sourceNodes,
      fanInEdges: fanInEdgeList,
      chain,
    };
  }

  const prefix: ArchitectureNode[] = [];
  let cur = nodes.find((n) => inEdges[n.id].length === 0)!;
  prefix.push(cur);
  while (cur.id !== fanOutNode!.id) {
    cur = nodes.find((n) => n.id === outEdges[cur.id][0].to)!;
    prefix.push(cur);
  }

  const rows: ArchitectureNode[][] = [];
  const foEdges = outEdges[fanOutNode!.id];
  for (const edge of foEdges) {
    const row: ArchitectureNode[] = [];
    let node = nodes.find((n) => n.id === edge.to)!;
    while (fanInNode ? node.id !== fanInNode.id : outEdges[node.id].length > 0) {
      row.push(node);
      if (outEdges[node.id].length === 0) break;
      node = nodes.find((n) => n.id === outEdges[node.id][0].to)!;
    }
    rows.push(row);
  }

  const suffix: ArchitectureNode[] = [];
  if (fanInNode) {
    suffix.push(fanInNode);
    cur = fanInNode;
    while (outEdges[cur.id].length > 0) {
      cur = nodes.find((n) => n.id === outEdges[cur.id][0].to)!;
      suffix.push(cur);
    }
  }

  return {
    type: "parallel",
    prefix,
    rows,
    suffix,
    fanOutEdges: foEdges,
    fanInEdges: fanInNode ? inEdges[fanInNode.id] : [],
  };
}

function LinearChain({
  chain,
  edges,
  skipLastArrow,
}: {
  chain: ArchitectureNode[];
  edges: ArchitectureEdge[];
  skipLastArrow?: boolean;
}) {
  return (
    <>
      {chain.map((node, i) => {
        const edge = edges.find((e) => e.from === node.id);
        const isLast = i === chain.length - 1;
        return (
          <Fragment key={node.id}>
            <NodeCard node={node} />
            {!isLast && !skipLastArrow && <AnimatedArrow label={edge?.label} />}
            {!isLast && skipLastArrow && i < chain.length - 2 && (
              <AnimatedArrow label={edge?.label} />
            )}
          </Fragment>
        );
      })}
    </>
  );
}

function RowChain({
  chain,
  edges,
}: {
  chain: ArchitectureNode[];
  edges: ArchitectureEdge[];
}) {
  return (
    <div className="flex items-center gap-0">
      {chain.map((node, i) => {
        const edge = edges.find((e) => e.from === node.id && chain.some((n) => n.id === e.to));
        return (
          <Fragment key={node.id}>
            <NodeCard node={node} />
            {i < chain.length - 1 && <AnimatedArrow label={edge?.label} />}
          </Fragment>
        );
      })}
    </div>
  );
}

export function ArchitectureDiagram({
  nodes,
  edges,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}) {
  const layout = buildLayout(nodes, edges);

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8">
      <h2 className="mb-6 text-lg font-semibold">Architecture</h2>
      <div className="flex items-center justify-center gap-0 overflow-x-auto">
        {layout.type === "linear" && (
          <LinearChain chain={layout.chain} edges={edges} />
        )}

        {layout.type === "fan-in" && (
          <>
            <div className="flex flex-col items-center gap-3 shrink-0">
              {layout.fanInSources.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
            <FanInArrows
              fromCount={layout.fanInSources.length}
              edges={layout.fanInEdges}
            />
            <LinearChain chain={layout.chain} edges={edges} />
          </>
        )}

        {layout.type === "parallel" && (
          <>
            <LinearChain
              chain={layout.prefix}
              edges={edges}
              skipLastArrow
            />
            <FanOutArrows
              toCount={layout.rows.length}
              edges={layout.fanOutEdges}
            />
            <div className="flex flex-col gap-6">
              {layout.rows.map((row, i) => (
                <RowChain key={i} chain={row} edges={edges} />
              ))}
            </div>
            {layout.fanInEdges.length > 0 && (
              <FanInArrows
                fromCount={layout.rows.length}
                edges={layout.fanInEdges}
              />
            )}
            {layout.suffix.length > 0 && (
              <LinearChain chain={layout.suffix} edges={edges} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
