export interface QueryResult {
  meta: { name: string; type: string }[];
  data: Record<string, unknown>[];
  rows: number;
  statistics: { elapsed: number; rows_read: number; bytes_read: number };
}

export async function runQuery(
  endpoint: string,
  apiKey: string,
  sql: string
): Promise<QueryResult> {
  const url = endpoint.replace(/\/+$/, "") + "/v1/query";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ sql }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Query failed (${res.status}): ${body}`);
  }

  return res.json();
}

const STORAGE_KEY = "rawtree-showroom-config";

export interface RawtreeConfig {
  endpoint: string;
  apiKey: string;
}

export function loadConfig(): RawtreeConfig | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveConfig(config: RawtreeConfig) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY);
}
