import type { UseCase } from "@/lib/types";
import { supabaseSuperstoreQueries } from "@/lib/dashboard-queries";

// Orders CDC events for the same source row: commit LSN (converted from
// Postgres '1/F20001D8' text into a sortable integer) + transaction ordinal.
// See the supabase-etl example README for the full query pattern.
const CDC_EVENT_ORDER =
  "tuple(reinterpretAsUInt64(reverse(unhex(concat(" +
  "leftPad(splitByChar('/', toString(_etl_commit_lsn))[1], 8, '0'), " +
  "leftPad(splitByChar('/', toString(_etl_commit_lsn))[2], 8, '0')" +
  ")))), toUInt64OrZero(toString(_etl_tx_ordinal)))";

// Only row-level CDC events; excludes transaction markers and rows whose
// latest event is a delete.
const LIVE_ROW = "toString(_etl_op) IN ('copy', 'insert', 'update')";

export const supabaseSuperstoreCdc: UseCase = {
  slug: "supabase-superstore-cdc",
  title: "Superstore Sales Analytics via Supabase CDC",
  shortDescription:
    "Stream the Kaggle Superstore sales dataset from Supabase Postgres into RawTree with logical replication, deployed to ECS Fargate by a single Terraform resource — or built from source and run manually on EC2.",
  description:
    "This use case streams a retail sales table from Supabase Postgres into RawTree using Change Data Capture. " +
    "The classic Kaggle Superstore Sales dataset (~9.8k order lines) is imported into Supabase, published via a " +
    "logical-replication publication, and consumed by the supabase/etl Rust worker, which lands every row event — " +
    "initial copy, insert, update, delete — in an append-only RawTree table. There are two ways to deploy the worker: " +
    "the rawtree_supabase_cdc_ingestion Terraform resource automates everything (Secrets Manager, IAM, CloudWatch, " +
    "ECS cluster and a long-running Fargate service), while the build-from-source path walks through the same setup " +
    "by hand on an EC2 instance using the Docker image from the rawtreedb/examples repository — a useful contrast that " +
    "shows exactly what the Terraform resource does for you. The dashboard reconstructs the live table state from the " +
    "CDC event log (latest event per primary key, ordered by commit LSN) and mirrors the analysis panels of a popular " +
    "Kaggle EDA notebook for this dataset: monthly sales trends, customer segments, regional performance, product " +
    "category breakdowns, shipping analysis, and seasonality — plus live CDC pipeline health.",
  tags: ["Supabase", "Postgres", "CDC", "Terraform", "ECS", "Retail"],
  category: "Database CDC",
  heroImage: "/use-cases/supabase-superstore-cdc/thumbnail.png",
  repos: [
    {
      name: "terraform-provider-rawtree",
      url: "https://github.com/rawtreedb/terraform-provider-rawtree",
    },
    {
      name: "examples / supabase-etl",
      url: "https://github.com/rawtreedb/examples/tree/main/postgres/supabase-etl",
    },
  ],
  architecture: {
    nodes: [
      {
        id: "dataset",
        label: "Superstore CSV",
        type: "script",
        description: "Kaggle dataset (~9.8k rows)",
      },
      {
        id: "supabase",
        label: "Supabase Postgres",
        type: "database",
        description: "Logical replication publication",
      },
      {
        id: "worker",
        label: "supabase/etl Worker",
        type: "connector",
        description: "ECS Fargate or EC2",
      },
      {
        id: "rawtree",
        label: "RawTree",
        type: "platform",
        description: "Append-only CDC event log",
      },
      {
        id: "dashboard",
        label: "Dashboard",
        type: "dashboard",
        description: "Sales analytics",
      },
    ],
    edges: [
      { from: "dataset", to: "supabase", label: "CSV import" },
      { from: "supabase", to: "worker", label: "Logical replication" },
      { from: "worker", to: "rawtree", label: "HTTP API" },
      { from: "rawtree", to: "dashboard", label: "SQL" },
    ],
  },
  dashboardConfig: {
    table: "public_superstore__sales__data",
    dateExpression: "parseDateTimeOrNull(toString(`Order Date`), '%d/%m/%Y')",
    dedupIdColumn: "toString(`Row ID`)",
    dedupTsColumn: CDC_EVENT_ORDER,
    stats: [
      {
        label: "Total Sales",
        sqlExpression: `round(sumIf(toFloat64OrZero(toString(\`Sales\`)), ${LIVE_ROW})) AS total_sales`,
        key: "total_sales",
      },
      {
        label: "Order Lines",
        sqlExpression: `countIf(${LIVE_ROW}) AS order_lines`,
        key: "order_lines",
      },
      {
        label: "Unique Orders",
        sqlExpression: `uniqIf(toString(\`Order ID\`)::String, ${LIVE_ROW}) AS unique_orders`,
        key: "unique_orders",
      },
      {
        label: "Unique Customers",
        sqlExpression: `uniqIf(toString(\`Customer ID\`)::String, ${LIVE_ROW}) AS unique_customers`,
        key: "unique_customers",
      },
    ],
  },
  dashboardQueries: supabaseSuperstoreQueries,
  setupGuides: [
    {
      method: "Terraform (ECS Fargate)",
      steps: [
        {
          title: "Prepare the Source Table in Supabase",
          content:
            "Create a Supabase project and import the Superstore Sales dataset (train.csv) via Table Editor → New table → " +
            "Import data from CSV, naming the table superstore_sales_data in the public schema. Supabase creates the table " +
            "and preserves the CSV column names verbatim (including spaces like \"Row ID\" and \"Order ID\"). " +
            "Then enable logical replication for the table in the SQL Editor.",
          codeBlock: {
            language: "sql",
            code: `-- REPLICA IDENTITY FULL makes UPDATEs / DELETEs include the full old row,
-- which the supabase/etl worker needs to emit complete CDC events.
ALTER TABLE public.superstore_sales_data REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS rawtree_superstore_publication;
CREATE PUBLICATION rawtree_superstore_publication
FOR TABLE public.superstore_sales_data;`,
          },
          notice: {
            text: "The dataset is the classic Superstore Sales train.csv (~9.8k rows) used by many Kaggle EDA notebooks.",
            link: {
              label: "Superstore Sales Dataset on Kaggle",
              url: "https://www.kaggle.com/datasets/rohitsahoo/sales-forecasting",
            },
          },
        },
        {
          title: "Get the Connection URL & CA Certificate",
          content:
            "Copy the Direct connection string from Project Settings → Database → Connection string — not the pooler URL, " +
            "because logical replication requires a direct replication connection. Supabase signs its Postgres certificates " +
            "with a private CA, so also download the certificate from Project Settings → Database → SSL Configuration.",
          codeBlock: {
            language: "bash",
            code: `# Alternative: dump the CA from the live TLS handshake
host=db.<your-project-ref>.supabase.co
openssl s_client -showcerts -starttls postgres -connect "$host:5432" </dev/null 2>/dev/null \\
  | awk '/-----BEGIN CERT/,/-----END CERT/' > ~/supabase-ca.crt`,
          },
          notice: {
            text: "The Supabase direct endpoint is typically IPv6-only — the Terraform example provisions a dual-stack VPC so the Fargate task can reach it.",
          },
        },
        {
          title: "Configure Providers",
          content:
            "Set your RawTree credentials as environment variables. The AWS provider uses your default credentials or AWS_PROFILE.",
          codeBlock: {
            language: "bash",
            code: `export RAWTREE_API_KEY="rt_..."
export RAWTREE_ORG="your-org"
export RAWTREE_PROJECT="your-project"

export TF_VAR_supabase_database_url='postgres://postgres:PASS@db.<ref>.supabase.co:5432/postgres?sslmode=require'`,
          },
        },
        {
          title: "Write Terraform Configuration",
          content:
            "A single rawtree_supabase_cdc_ingestion resource provisions everything: a Secrets Manager secret for the API key " +
            "and database URL, an IAM execution role, a CloudWatch log group, an ECS cluster, and a long-running Fargate " +
            "service running the supabase/etl worker image. The networking below assumes a dual-stack subnet — copy the " +
            "self-contained VPC from the provider's example.",
          codeBlock: {
            language: "terraform",
            code: `terraform {
  required_providers {
    rawtree = { source = "rawtreedb/rawtree" }
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
  }
}

provider "rawtree" {}
provider "aws" { region = "us-east-1" }

variable "supabase_database_url" {
  type      = string
  sensitive = true
}

resource "rawtree_supabase_cdc_ingestion" "superstore" {
  name        = "superstore"
  region      = "us-east-1"
  publication = "rawtree_superstore_publication"

  # For production, prefer database_url_secret_arn /
  # tls_root_cert_secret_arn pointing at secrets you manage —
  # those values never enter Terraform state.
  database_url      = var.supabase_database_url
  tls_root_cert_pem = file("~/supabase-ca.crt")

  subnet_ids       = [aws_subnet.this.id] # dual-stack subnet
  assign_public_ip = true                 # IPv4 for the ghcr.io image pull

  cpu    = 512
  memory = 1024
}

output "log_group_name" {
  value = rawtree_supabase_cdc_ingestion.superstore.log_group_name
}`,
          },
          notice: {
            text: "The full example includes the dual-stack VPC, subnet, and routing the worker needs for IPv6 egress to Supabase.",
            link: {
              label: "Complete example with VPC — terraform-provider-rawtree",
              url: "https://github.com/rawtreedb/terraform-provider-rawtree/tree/main/examples/resources/supabase_cdc_ingestion",
            },
          },
        },
        {
          title: "Apply & Verify",
          content:
            "Apply the configuration, then tail the worker logs. On first start the worker performs an initial copy of all " +
            "~9.8k rows into the RawTree table public_superstore__sales__data (the destination name doubles source " +
            "underscores), then streams live changes from the replication slot.",
          codeBlock: {
            language: "bash",
            code: `terraform init
terraform apply

# Tail the Fargate worker logs
aws logs tail $(terraform output -raw log_group_name) --follow

# Verify rows are landing in RawTree
rtree query "SELECT count() FROM public_superstore__sales__data"`,
          },
        },
        {
          title: "Open the Dashboard",
          content:
            "Create a read-only API key and connect the dashboard. Insert, update, or delete rows in Supabase and watch the " +
            "CDC Operations panel pick up the changes within seconds.",
          codeBlock: {
            language: "bash",
            code: `rtree key create --name superstore-dashboard --permission read`,
          },
        },
      ],
    },
    {
      method: "Build from Source (EC2)",
      steps: [
        {
          title: "Prepare the Source Table in Supabase",
          content:
            "Identical to the Terraform path: import the Superstore Sales train.csv as public.superstore_sales_data, set " +
            "REPLICA IDENTITY FULL, create the publication, copy the direct connection string, and download the CA " +
            "certificate. Everything after this step is what the rawtree_supabase_cdc_ingestion Terraform resource " +
            "automates — doing it by hand shows the moving parts.",
          codeBlock: {
            language: "sql",
            code: `ALTER TABLE public.superstore_sales_data REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS rawtree_superstore_publication;
CREATE PUBLICATION rawtree_superstore_publication
FOR TABLE public.superstore_sales_data;`,
          },
        },
        {
          title: "Launch an EC2 Instance",
          content:
            "Launch an Amazon Linux 2023 instance (t3.small is plenty) in a dual-stack subnet so it has an IPv6 route — " +
            "the Supabase direct Postgres endpoint is typically IPv6-only. The security group needs no inbound rules, " +
            "only outbound. Install Docker and Git once you're in.",
          codeBlock: {
            language: "bash",
            code: `sudo dnf install -y docker git
sudo systemctl enable --now docker

# Confirm the instance can reach Supabase over IPv6
ping6 -c 2 db.<your-project-ref>.supabase.co`,
          },
          notice: {
            text: "If the ping fails, the subnet has no IPv6 route — add an IPv6 CIDR and a ::/0 route, or pick a dual-stack subnet.",
          },
        },
        {
          title: "Clone & Build the Worker Image",
          content:
            "The supabase-etl example in the rawtreedb/examples repository contains the Rust pipeline and a Dockerfile. " +
            "Build the image on the instance (or pull the prebuilt ghcr.io/rawtreedb/supabase-etl:latest image instead).",
          codeBlock: {
            language: "bash",
            code: `git clone https://github.com/rawtreedb/examples.git
cd examples/postgres/supabase-etl
sudo docker build -t rawtree-supabase-etl .`,
          },
          notice: {
            text: "This is the same source the published worker image is built from.",
            link: {
              label: "postgres/supabase-etl — rawtreedb/examples",
              url: "https://github.com/rawtreedb/examples/tree/main/postgres/supabase-etl",
            },
          },
        },
        {
          title: "Configure the Environment",
          content:
            "Copy the example env file and fill in your values. Use the Supabase direct database URL, not the pooler — " +
            "logical replication needs a direct replication connection. Copy the CA certificate to the instance too " +
            "(scp ~/supabase-ca.crt ec2-user@<instance>:~).",
          codeBlock: {
            language: "bash",
            code: `cp .env.example .env.local

# .env.local
RAWTREE_API_KEY=rt_...
RAWTREE_ORG=your-org
RAWTREE_PROJECT=your-project
DATABASE_URL=postgres://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres?sslmode=require
POSTGRES_PUBLICATION=rawtree_superstore_publication
POSTGRES_TLS_ROOT_CERT_PATH=/certs/supabase-ca.crt`,
          },
          notice: {
            text: "On ECS, the Terraform resource stores these values in a Secrets Manager secret and injects them into the task — on EC2 you manage the plaintext env file and its permissions yourself.",
          },
        },
        {
          title: "Run the Worker",
          content:
            "Start the container with a restart policy so it survives crashes and reboots. On first run the worker creates " +
            "its internal metadata (the etl schema and the supabase_etl_apply_1 replication slot) in the source database, " +
            "performs the initial copy, then streams live changes.",
          codeBlock: {
            language: "bash",
            code: `sudo docker run -d --name rawtree-supabase-etl \\
  --restart unless-stopped \\
  --env-file .env.local \\
  -v ~/supabase-ca.crt:/certs/supabase-ca.crt:ro \\
  rawtree-supabase-etl

sudo docker logs -f rawtree-supabase-etl`,
          },
          notice: {
            text: "Unlike the ECS service, nothing supervises this instance: patching, log retention, monitoring, and replacing the box are on you. That operational gap is the main argument for the Terraform path.",
          },
        },
        {
          title: "Verify & Clean Up",
          content:
            "Confirm rows are landing in RawTree, then connect the dashboard with a read-only API key. When tearing down, " +
            "stop the worker first, then drop the replication slot — an orphaned slot pins WAL in your Supabase project.",
          codeBlock: {
            language: "bash",
            code: `rtree query "SELECT count() FROM public_superstore__sales__data"`,
          },
          notice: {
            text: "After stopping the worker permanently, run: SELECT pg_drop_replication_slot('supabase_etl_apply_1'); in Supabase to release pinned WAL.",
          },
        },
      ],
    },
  ],
  publishedAt: "2026-06-11",
};
