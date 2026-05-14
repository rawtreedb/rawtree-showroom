import { Fragment } from "react";
import type { ArchitectureNode, ArchitectureEdge } from "@/lib/types";
import {
  Globe,
  Database,
  Cable,
  BarChart3,
  LayoutDashboard,
  Terminal,
} from "lucide-react";

const iconMap: Record<string, typeof Globe> = {
  source: Globe,
  database: Database,
  connector: Cable,
  platform: BarChart3,
  dashboard: LayoutDashboard,
  script: Terminal,
};

const colorMap: Record<string, string> = {
  source: "text-emerald-500",
  database: "text-green-500",
  connector: "text-blue-500",
  platform: "text-primary",
  dashboard: "text-amber-500",
  script: "text-violet-500",
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

function FanInArrows({
  fromNodes,
  edges,
}: {
  fromNodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}) {
  const n = fromNodes.length;
  const h = 200;
  const w = 100;
  const midY = h / 2;
  const pad = 35;
  const spread = 18;
  const yPositions = fromNodes.map((_, i) =>
    n === 1 ? midY : pad + (i / (n - 1)) * (h - 2 * pad)
  );
  const yEnds = fromNodes.map((_, i) =>
    n === 1 ? midY : midY + (i - (n - 1) / 2) * spread
  );

  return (
    <div className="flex items-center justify-center px-1 min-w-[40px] flex-1 max-w-[100px] self-stretch">
      <svg
        className="w-full h-full"
        viewBox={`0 0 ${w} ${h}`}
        fill="none"
      >
        {fromNodes.map((node, i) => {
          const edge = edges.find((e) => e.from === node.id);
          const yFrom = yPositions[i];
          const yTo = yEnds[i];
          const t = 0.3;
          const labelX = 50;
          const goingDown = yFrom < midY;
          const labelY = yFrom + t * (yTo - yFrom) + (goingDown ? -16 : 26);

          return (
            <g key={node.id}>
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

function buildRenderOrder(
  nodes: ArchitectureNode[],
  edges: ArchitectureEdge[]
) {
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

  const fanInEntry = Object.entries(inEdges).find(
    ([, es]) => es.length > 1
  );

  if (!fanInEntry) {
    let current = nodes.find((n) => inEdges[n.id].length === 0)!;
    const chain: ArchitectureNode[] = [current];
    while (outEdges[current.id].length > 0) {
      current = nodes.find((n) => n.id === outEdges[current.id][0].to)!;
      chain.push(current);
    }
    return { fanIn: null, chain };
  }

  const [fanInId, fanInEdgeList] = fanInEntry;
  const fanInNode = nodes.find((n) => n.id === fanInId)!;
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
    fanIn: { sources: sourceNodes, edges: fanInEdgeList },
    chain,
  };
}

export function ArchitectureDiagram({
  nodes,
  edges,
}: {
  nodes: ArchitectureNode[];
  edges: ArchitectureEdge[];
}) {
  const { fanIn, chain } = buildRenderOrder(nodes, edges);

  return (
    <div className="rounded-xl border bg-card p-6 md:p-8">
      <h2 className="mb-6 text-lg font-semibold">Architecture</h2>
      <div className="flex items-center justify-center gap-0">
        {fanIn && (
          <>
            <div className="flex flex-col items-center gap-3 shrink-0">
              {fanIn.sources.map((node) => (
                <NodeCard key={node.id} node={node} />
              ))}
            </div>
            <FanInArrows fromNodes={fanIn.sources} edges={fanIn.edges} />
          </>
        )}
        {chain.map((node, i) => {
          const edge = edges.find((e) => e.from === node.id);
          return (
            <Fragment key={node.id}>
              <NodeCard node={node} />
              {i < chain.length - 1 && <AnimatedArrow label={edge?.label} />}
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
