# RawTree Showroom

Open-source, self-hostable dashboards backed by RawTree. The Jev PR quality
dashboard turns structured CI review events into contributor, pass-rate, and
quality-trend views.

## Use the Jev dashboard

Open `/use-cases/jev-pr-quality/dashboard` and enter a RawTree **read-only** API
key. The browser sends dashboard queries directly to `https://api.rawtree.com`.
The key is held only in the current tab's memory: it is not persisted, placed in
the URL, or sent to the Showroom server.

The matching GitHub workflow writes events with a separate **write-only** key.
Never reuse that write key in the dashboard. The expected table is
`jev_pr_reviews`; its event schema and setup instructions live with the Jev
workflow in [`rawtreedb/rawtree-platform`](https://github.com/rawtreedb/rawtree-platform/tree/main/scripts/jev-review).

## Run locally

Requirements: Node.js 24 and npm.

```sh
npm ci
npm run dev
```

Open <http://localhost:3000/use-cases/jev-pr-quality/dashboard>. No server-side
RawTree credential or environment file is required.

## Self-host with Docker

```sh
docker build -t rawtree-showroom .
docker run --rm -p 3000:3000 rawtree-showroom
```

The production image runs as an unprivileged user and contains Next.js's minimal
standalone server. It does not contain a RawTree API key. Put TLS in front of the
container before asking users to enter credentials.

## Deploy without Docker

Any Node.js host can run the application:

```sh
npm ci
npm run build
npm run start
```

Vercel and other Next.js-compatible platforms can deploy the repository without
additional configuration. The application needs outbound browser access to
`https://api.rawtree.com`; its production Content Security Policy permits only
that API and same-origin resources.

## Add a dashboard

See [`docs/adding-a-dashboard.md`](docs/adding-a-dashboard.md) for the dashboard
schema, supported charts, deduplication helpers, and registration steps.
