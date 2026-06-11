import { NextRequest, NextResponse } from "next/server";

function envForSlug(slug: string | undefined, key: string): string | undefined {
  if (slug) {
    const slugKey = slug.toUpperCase().replace(/-/g, "_");
    const value = process.env[`RAWTREE_DEMO_${key}_${slugKey}`];
    if (value) return value;
  }
  return process.env[`RAWTREE_DEMO_${key}`];
}

export async function POST(req: NextRequest) {
  const { sql, slug } = (await req.json()) as { sql?: string; slug?: string };

  const DEMO_ENDPOINT = envForSlug(slug, "ENDPOINT");
  const DEMO_API_KEY = envForSlug(slug, "API_KEY");

  if (!DEMO_ENDPOINT || !DEMO_API_KEY) {
    return NextResponse.json(
      { error: "Demo mode is not configured" },
      { status: 503 },
    );
  }

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
