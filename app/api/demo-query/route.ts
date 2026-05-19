import { NextRequest, NextResponse } from "next/server";

const DEMO_ENDPOINT = process.env.RAWTREE_DEMO_ENDPOINT;
const DEMO_API_KEY = process.env.RAWTREE_DEMO_API_KEY;

export async function POST(req: NextRequest) {
  if (!DEMO_ENDPOINT || !DEMO_API_KEY) {
    return NextResponse.json(
      { error: "Demo mode is not configured" },
      { status: 503 },
    );
  }

  const { sql } = (await req.json()) as { sql?: string };
  if (!sql || typeof sql !== "string") {
    return NextResponse.json({ error: "Missing sql field" }, { status: 400 });
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

  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": "application/json" },
  });
}
