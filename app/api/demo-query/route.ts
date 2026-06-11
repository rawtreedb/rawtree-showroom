import { NextRequest, NextResponse } from "next/server";
import { getUseCaseBySlug } from "@/lib/use-cases";
import {
  buildDateRangeQuery,
  buildStatsQuery,
  injectDateFilter,
} from "@/lib/dashboard-queries";

function envForSlug(slug: string | undefined, key: string): string | undefined {
  if (slug) {
    const slugKey = slug.toUpperCase().replace(/-/g, "_");
    const value = process.env[`RAWTREE_DEMO_${key}_${slugKey}`];
    if (value) return value;
  }
  return process.env[`RAWTREE_DEMO_${key}`];
}

interface DemoQueryPayload {
  slug?: string;
  queryId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as DemoQueryPayload;
  const { slug, queryId, dateFrom, dateTo } = body;

  const DEMO_ENDPOINT = envForSlug(slug, "ENDPOINT");
  const DEMO_API_KEY = envForSlug(slug, "API_KEY");

  if (!DEMO_ENDPOINT || !DEMO_API_KEY) {
    return NextResponse.json(
      { error: "Demo mode is not configured" },
      { status: 503 },
    );
  }

  if (!queryId || typeof queryId !== "string") {
    return NextResponse.json({ error: "Missing queryId" }, { status: 400 });
  }

  if (!slug || typeof slug !== "string") {
    return NextResponse.json({ error: "Missing slug" }, { status: 400 });
  }

  const useCase = getUseCaseBySlug(slug);
  if (!useCase) {
    return NextResponse.json({ error: "Unknown use case" }, { status: 404 });
  }

  let sql: string;

  if (queryId === "__date_range__") {
    sql = buildDateRangeQuery(useCase.dashboardConfig);
  } else if (queryId === "__stats__") {
    sql = buildStatsQuery(useCase.dashboardConfig);
  } else {
    const query = useCase.dashboardQueries.find((q) => q.id === queryId);
    if (!query) {
      return NextResponse.json({ error: "Unknown queryId" }, { status: 404 });
    }
    sql = query.sql;
    if (!query.skipDateFilter && dateFrom && dateTo) {
      sql = injectDateFilter(
        sql,
        dateFrom,
        dateTo,
        useCase.dashboardConfig.dateExpression,
      );
    }
  }

  const url = DEMO_ENDPOINT.replace(/\/+$/, "") + "/v1/query";
  const upstream = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEMO_API_KEY}`,
    },
    body: JSON.stringify({ sql }),
  });

  const responseBody = await upstream.text();
  return new NextResponse(responseBody, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
