import type { UseCase } from "@/lib/types";
import { ghArchiveQueries } from "@/lib/dashboard-queries";

export const ghArchiveMongodbCdc: UseCase = {
  slug: "gh-archive-mongodb-cdc",
  title: "GitHub Events Analytics via MongoDB CDC",
  shortDescription:
    "Stream GitHub Archive events from MongoDB Atlas to RawTree using Change Data Capture, and analyze developer activity in real time.",
  description:
    "This use case demonstrates a real-time analytics pipeline for GitHub events. Data from the GitHub Archive is loaded into MongoDB Atlas, then streamed into RawTree via the rawtree-mongo-connector using Change Data Capture (CDC). The result is a set of analytical queries over millions of GitHub events — pushes, pull requests, issues, forks, and more — enabling dashboards that show developer activity, repository trends, and event throughput in real time.",
  tags: ["MongoDB", "CDC", "GitHub", "Time Series", "Change Streams"],
  category: "Database CDC",
  heroImage: "/use-cases/gh-archive-mongodb-cdc/thumbnail.png",
  repos: [
    { name: "rawtree-mongo-connector", url: "https://github.com/rawtreedb/rawtree-mongo-connector" },
    { name: "terraform-provider-rawtree", url: "https://github.com/rawtreedb/terraform-provider-rawtree" },
  ],
  architecture: {
    nodes: [
      {
        id: "gharchive",
        label: "GH Archive",
        type: "source",
        description: "~200k events/hour",
      },
      {
        id: "continuous",
        label: "Event generator",
        type: "script",
        description: "Synthetic events",
      },
      {
        id: "mongodb",
        label: "MongoDB Atlas",
        type: "database",
        description: "Change Streams enabled",
      },
      {
        id: "connector",
        label: "RawTree Mongo CDC Connector",
        type: "connector",
        description: "Snapshot + CDC",
      },
      {
        id: "rawtree",
        label: "RawTree",
        type: "platform",
        description: "ClickHouse analytics",
      },
      {
        id: "dashboard",
        label: "Dashboard",
        type: "dashboard",
        description: "SQL queries & charts",
      },
    ],
    edges: [
      { from: "gharchive", to: "mongodb", label: "mongoimport" },
      { from: "continuous", to: "mongodb", label: "mongosh" },
      { from: "mongodb", to: "connector", label: "Change Streams" },
      { from: "connector", to: "rawtree", label: "HTTP API" },
      { from: "rawtree", to: "dashboard", label: "SQL" },
    ],
  },
  dashboardConfig: {
    table: "mongo_events",
    dateExpression: "parseDateTime64BestEffort(toString(_rt_doc.created_at))",
    dedupIdColumn: "_rt_id",
    dedupTsColumn: "_rt_ts",
    stats: [
      { label: "Total Events", sqlExpression: "count() AS total_events", key: "total_events" },
      { label: "Unique Repos", sqlExpression: "uniq(toString(_rt_doc.repo.name)::String) AS unique_repos", key: "unique_repos" },
      { label: "Unique Contributors", sqlExpression: "uniq(toString(_rt_doc.actor.login)::String) AS unique_contributors", key: "unique_contributors" },
    ],
  },
  dashboardQueries: ghArchiveQueries,
  setupGuides: [
    {
      method: "Build from main",
      steps: [
        {
          title: "Clone & Prerequisites",
          content:
            "Clone the rawtree-mongo-connector repository.",
          notice: {
            text: "You will need Go 1.22+, mongoimport, mongosh, and direnv installed.",
            link: {
              label: "See the full prerequisites in the README",
              url: "https://github.com/rawtreedb/rawtree-mongo-connector#prerequisites",
            },
          },
          codeBlock: {
            language: "bash",
            code: `git clone https://github.com/rawtreedb/rawtree-mongo-connector.git
cd rawtree-mongo-connector/tools/gharchive_ingestion`,
          },
        },
        {
          title: "Configure Environment",
          content:
            "Copy the environment template and fill in your MongoDB Atlas URI and RawTree credentials. The .envrc file uses direnv to auto-load variables when you enter the directory.",
          codeBlock: {
            language: "bash",
            code: `cp .env.example.local .env.local
# Edit .env.local — set your MongoDB Atlas URI and RawTree API key
direnv allow`,
          },
        },
        {
          title: "Load Data into MongoDB Atlas",
          content:
            "Run the load script to download GitHub Archive events and import them into your MongoDB Atlas cluster. The script downloads hourly JSON files and streams them through mongoimport.",
          codeBlock: {
            language: "bash",
            code: `./load-gharchive.sh 50000  # Load 50k events (~150 MB)`,
          },
        },
        {
          title: "Build & Start the Connector",
          content:
            "Build the Go binary from the repo root, then run it from the ingestion directory so direnv loads your environment variables. The connector snapshots existing data first, then switches to CDC mode.",
          codeBlock: {
            language: "bash",
            code: `# From the repo root
make build

# From tools/gharchive_ingestion (direnv loads .env.local)
cd tools/gharchive_ingestion
../../bin/rawtree-mongo-connector --config config.yaml`,
          },
        },
        {
          title: "Create a RawTree API Key",
          content:
            "Create an API key to use with the live dashboard. You can use the CLI or go to console.rawtree.com → Settings → API Keys.",
          codeBlock: {
            language: "bash",
            code: `# Install the CLI
curl -sSf https://rawtree.com | sh

# Authenticate and create a key
rtree login
rtree key create --name mongo-cdc --permission read_write`,
          },
        },
        {
          title: "Simulate Live Traffic",
          content:
            "Run the continuous insert script to generate synthetic GitHub events. Timestamps continue from the latest event in the collection — no gaps.",
          codeBlock: {
            language: "bash",
            code: `./continuous-insert.sh        # 50 events every 10s
./continuous-insert.sh 100 5  # 100 events every 5s`,
          },
        },
      ],
    },
    {
      method: "Helm",
      steps: [
        {
          title: "Clone & Prerequisites",
          content:
            "Clone the rawtree-mongo-connector repository for the ingestion scripts.",
          notice: {
            text: "You will need Helm, kubectl, mongoimport, mongosh, and direnv installed.",
            link: {
              label: "See the full prerequisites in the README",
              url: "https://github.com/rawtreedb/rawtree-mongo-connector#prerequisites",
            },
          },
          codeBlock: {
            language: "bash",
            code: `git clone https://github.com/rawtreedb/rawtree-mongo-connector.git
cd rawtree-mongo-connector/tools/gharchive_ingestion`,
          },
        },
        {
          title: "Configure Environment",
          content:
            "Copy the environment template and fill in your MongoDB Atlas URI. These variables are used by the data loading scripts.",
          codeBlock: {
            language: "bash",
            code: `cp .env.example.local .env.local
# Edit .env.local — set RAWTREE_MONGO_MONGODB_URI
direnv allow`,
          },
        },
        {
          title: "Load Data into MongoDB Atlas",
          content:
            "Run the load script to download GitHub Archive events and import them into your MongoDB Atlas cluster.",
          codeBlock: {
            language: "bash",
            code: `./load-gharchive.sh 50000  # Load 50k events (~150 MB)`,
          },
        },
        {
          title: "Deploy the Connector with Helm",
          content:
            "Add the RawTree Helm repository and install the connector chart. Create a values file with your MongoDB and RawTree credentials.",
          codeBlock: {
            language: "bash",
            code: `helm repo add rawtree https://charts.rawtree.com
helm repo update

cat > values-gharchive.yaml <<'EOF'
config:
  mongodb:
    database: "github_events"
    collections:
      events:
        tablePrefix: "mongo_"
  rawtree:
    endpoint: "https://api.rawtree.com"
    organization: "my-org"
    project: "my-project"

secrets:
  mongodbUri: "mongodb+srv://user:pass@cluster.mongodb.net"
  rawtreeApiKey: "rt_..."
EOF

helm install gh-connector rawtree/rawtree-mongo-connector \\
  -f values-gharchive.yaml`,
          },
        },
        {
          title: "Create a RawTree API Key",
          content:
            "Create an API key to use with the live dashboard. You can use the CLI or go to console.rawtree.com → Settings → API Keys.",
          codeBlock: {
            language: "bash",
            code: `curl -sSf https://rawtree.com | sh
rtree login
rtree key create --name mongo-cdc --permission read_write`,
          },
        },
        {
          title: "Simulate Live Traffic",
          content:
            "Run the continuous insert script to generate synthetic GitHub events. Timestamps continue from the latest event in the collection.",
          codeBlock: {
            language: "bash",
            code: `./continuous-insert.sh        # 50 events every 10s
./continuous-insert.sh 100 5  # 100 events every 5s`,
          },
        },
      ],
    },
    {
      method: "Terraform",
      steps: [],
      comingSoonMessage:
        "Terraform support for the MongoDB CDC connector is on our roadmap.",
    },
  ],
  publishedAt: "2026-05-13",
};
