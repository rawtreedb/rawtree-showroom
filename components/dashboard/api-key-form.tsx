"use client";

import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { RawtreeConfig } from "@/lib/rawtree-api";

export function ApiKeyForm({
  onConnect,
}: {
  onConnect: (config: RawtreeConfig) => void;
}) {
  const [endpoint, setEndpoint] = useState("https://api.rawtree.com");
  const [apiKey, setApiKey] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const config = { endpoint: endpoint.trim(), apiKey: apiKey.trim() };
    onConnect(config);
  }

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <div className="mb-6 inline-flex size-14 items-center justify-center rounded-xl border bg-card">
        <KeyRound className="size-7 text-primary" />
      </div>
      <h2 className="mb-2 text-xl font-semibold">Connect to RawTree</h2>
      <p className="mb-8 text-sm text-muted-foreground">
        Enter your RawTree API key to load the live dashboard. Credentials are
        kept in memory for this tab only and are not saved; refreshing the page
        clears them.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4 text-left">
        <div>
          <label className="mb-1.5 block text-xs font-medium">
            API Endpoint
          </label>
          <input
            type="url"
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="https://api.rawtree.com"
            required
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-medium">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="rw_..."
            required
          />
        </div>
        <Button className="w-full" type="submit">
          Connect & Load Dashboard
        </Button>
      </form>
    </div>
  );
}
