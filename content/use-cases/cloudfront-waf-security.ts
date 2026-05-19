import type { UseCase } from "@/lib/types";
import { wafSecurityQueries } from "@/lib/dashboard-queries";

export const cloudfrontWafSecurity: UseCase = {
  slug: "cloudfront-waf-security",
  title: "CloudFront & WAF Security Dashboard",
  shortDescription:
    "Stream AWS WAF and CloudFront real-time logs into RawTree with Terraform, and monitor traffic, cache performance, and network attacks in a unified dashboard.",
  description:
    "This use case deploys a complete observability pipeline for an AWS CloudFront distribution protected by WAF. " +
    "Two Terraform resources — rawtree_waf_ingestion and rawtree_cloudfront_ingestion — provision all the required " +
    "AWS infrastructure (Firehose, Kinesis, IAM roles, S3 backup buckets) and wire logs into separate RawTree tables. " +
    "The dashboard combines both data sources: WAF logs provide security visibility (blocked IPs, terminating rules, " +
    "attack categories, geo-distribution of threats), while CloudFront real-time logs show traffic health (cache hit " +
    "ratio, latency percentiles, status codes, bandwidth, edge locations). Together they give security and platform " +
    "teams a single pane of glass for real-time traffic monitoring and attack detection.",
  tags: ["AWS", "CloudFront", "WAF", "Security", "Terraform"],
  category: "Network Security",
  heroImage: "/use-cases/cloudfront-waf-security/thumbnail.png",
  repos: [
    { name: "terraform-provider-rawtree", url: "https://github.com/rawtreedb/terraform-provider-rawtree" },
  ],
  architecture: {
    nodes: [
      { id: "cloudfront", label: "CloudFront", type: "source", description: "CDN Distribution" },
      { id: "waf", label: "AWS WAF", type: "firewall", description: "Web ACL Rules" },
      { id: "firehose-waf", label: "Firehose", type: "connector", description: "DirectPut → HTTP" },
      { id: "rawtree-waf", label: "RawTree", type: "platform", description: "waf_logs" },
      { id: "kinesis", label: "Kinesis", type: "connector", description: "Data Stream" },
      { id: "firehose-cf", label: "Firehose", type: "connector", description: "Kinesis → HTTP" },
      { id: "rawtree-cf", label: "RawTree", type: "platform", description: "cloudfront_logs" },
      { id: "dashboard", label: "Dashboard", type: "dashboard", description: "Unified View" },
    ],
    edges: [
      { from: "cloudfront", to: "waf", label: "ACL Logs" },
      { from: "waf", to: "firehose-waf", label: "WAF Logs" },
      { from: "firehose-waf", to: "rawtree-waf", label: "HTTP API" },
      { from: "cloudfront", to: "kinesis", label: "Real-Time" },
      { from: "kinesis", to: "firehose-cf", label: "Stream" },
      { from: "firehose-cf", to: "rawtree-cf", label: "HTTP API" },
      { from: "rawtree-waf", to: "dashboard", label: "SQL" },
      { from: "rawtree-cf", to: "dashboard", label: "SQL" },
    ],
  },
  dashboardConfig: {
    table: "waf_logs",
    dateExpression: "fromUnixTimestamp64Milli(toInt64(`timestamp`))",
    dedupIdColumn: "toString(`httpRequest.requestId`)",
    dedupTsColumn: "inserted_at",
    stats: [
      {
        label: "Total Requests",
        sqlExpression: "count() AS total_requests",
        key: "total_requests",
      },
      {
        label: "Blocked Requests",
        sqlExpression: "countIf(`action` = 'BLOCK') AS blocked_requests",
        key: "blocked_requests",
      },
      {
        label: "Block Rate %",
        sqlExpression: "round(countIf(`action` = 'BLOCK') * 100.0 / count(), 1) AS block_rate",
        key: "block_rate",
      },
      {
        label: "Unique Source IPs",
        sqlExpression: "uniq(toString(`httpRequest.clientIp`)) AS unique_ips",
        key: "unique_ips",
      },
    ],
  },
  dashboardQueries: wafSecurityQueries,
  setupGuides: [
    {
      method: "Terraform",
      steps: [
        {
          title: "Prerequisites",
          content:
            "You need an existing CloudFront distribution with a WAFv2 Web ACL attached. " +
            "The Terraform provider will create all the ingestion infrastructure (Firehose, Kinesis, IAM roles, S3 backup buckets).",
          notice: {
            text: "Requires Terraform 1.0+, AWS credentials with admin-level access, and a RawTree account.",
            link: {
              label: "Terraform provider documentation",
              url: "https://github.com/rawtreedb/terraform-provider-rawtree",
            },
          },
        },
        {
          title: "Configure Providers",
          content:
            "Set your RawTree credentials as environment variables. The AWS provider uses your default credentials or AWS_PROFILE.",
          codeBlock: {
            language: "bash",
            code: `export RAWTREE_API_KEY="rw_..."
export RAWTREE_ORG="your-org"
export RAWTREE_PROJECT="your-project"`,
          },
        },
        {
          title: "Write Terraform Configuration",
          content:
            "Create a main.tf with both ingestion resources. Each resource provisions its own Firehose delivery stream, " +
            "IAM roles, and S3 backup bucket. WAF logs go to waf_logs, CloudFront real-time logs go to cloudfront_logs.",
          codeBlock: {
            language: "terraform",
            code: `terraform {
  required_providers {
    aws     = { source = "hashicorp/aws", version = "~> 5.0" }
    rawtree = { source = "rawtreedb/rawtree" }
  }
}

provider "aws" { region = "us-east-1" }
provider "rawtree" {}

variable "web_acl_arn"     { type = string }
variable "distribution_id" { type = string }

resource "rawtree_waf_ingestion" "waf" {
  table       = "waf_logs"
  web_acl_arn = var.web_acl_arn
  region      = "us-east-1"
}

resource "rawtree_cloudfront_ingestion" "cf" {
  table           = "cloudfront_logs"
  distribution_id = var.distribution_id
  region          = "us-east-1"
}`,
          },
        },
        {
          title: "Apply",
          content:
            "Initialize and apply. Terraform will create ~10 AWS resources per ingestion pipeline (IAM roles, policies, " +
            "Firehose streams, Kinesis stream, S3 buckets, CloudWatch log groups, WAF logging config, and CloudFront real-time log config).",
          codeBlock: {
            language: "bash",
            code: `terraform init
terraform apply \\
  -var web_acl_arn="arn:aws:wafv2:us-east-1:123456789:regional/webacl/my-acl/..." \\
  -var distribution_id="E1ABCDEF123456"`,
          },
        },
        {
          title: "Generate Traffic",
          content:
            "Send mixed legitimate and attack traffic to your CloudFront distribution. " +
            "The generate-traffic.sh script is included in the terraform-provider-rawtree repository under test/lab/.",
          codeBlock: {
            language: "bash",
            code: `# Mixed traffic (legit + attacks)
./generate-traffic.sh your-distribution.cloudfront.net 20

# Legitimate only
./generate-traffic.sh your-distribution.cloudfront.net 100 --legit

# Heavy attack traffic
docker run --rm wallarm/gotestwaf \\
  --url https://your-distribution.cloudfront.net \\
  --skipWAFBlockCheck`,
          },
        },
        {
          title: "Open the Dashboard",
          content:
            "Wait 1-2 minutes for Firehose to deliver the first batch of logs, then connect the dashboard " +
            "with your RawTree API endpoint and key. You should see WAF decisions, status codes, cache performance, " +
            "and attack patterns populate in real time.",
          codeBlock: {
            language: "bash",
            code: `# Create a read-only API key for the dashboard
curl -sSf https://rawtree.com | sh
rtree login
rtree key create --name waf-dashboard --permission read`,
          },
        },
      ],
    },
    {
      method: "AWS Console",
      steps: [
        {
          title: "Create an S3 Backup Bucket",
          content:
            "In the S3 console, create a bucket for Firehose failed-delivery backup (e.g. rawtree-waf-backup). " +
            "Enable server-side encryption and keep the default settings.",
          notice: {
            text: "The bucket must be in the same region as your Firehose delivery stream.",
            link: {
              label: "Creating a bucket — Amazon S3 docs",
              url: "https://docs.aws.amazon.com/AmazonS3/latest/userguide/create-bucket-overview.html",
            },
          },
        },
        {
          title: "Create an IAM Role for Firehose",
          content:
            "In the IAM console, create a new role with the Firehose service as the trusted entity. " +
            "Attach a policy that grants s3:PutObject to your backup bucket and allows Firehose to write CloudWatch logs. " +
            "Note the role ARN — you will need it when creating the delivery stream.",
          notice: {
            text: "Use the principle of least privilege: scope the S3 policy to the specific backup bucket ARN.",
            link: {
              label: "Grant Firehose access — Amazon Data Firehose docs",
              url: "https://docs.aws.amazon.com/firehose/latest/dev/controlling-access.html",
            },
          },
        },
        {
          title: "Create a Firehose Delivery Stream (WAF Logs)",
          content:
            "In the Amazon Data Firehose console, create a delivery stream with source 'Direct PUT' and destination " +
            "'HTTP Endpoint'. Set the endpoint URL to your RawTree table endpoint " +
            "(e.g. https://api.rawtree.com/v1/{org}/{project}/tables/waf_logs?transform=firehose). " +
            "Paste your RawTree API key as the access key. Configure the S3 backup bucket for failed deliveries. " +
            "The stream name must start with 'aws-waf-logs-' for WAF to accept it.",
          notice: {
            text: "WAF requires the Firehose stream name to begin with 'aws-waf-logs-'.",
            link: {
              label: "Creating a delivery stream — Amazon Data Firehose docs",
              url: "https://docs.aws.amazon.com/firehose/latest/dev/basic-create.html",
            },
          },
        },
        {
          title: "Enable WAF Logging",
          content:
            "In the AWS WAF console, navigate to your Web ACL and open the Logging and metrics tab. " +
            "Click 'Enable logging' and select the Firehose delivery stream you just created. " +
            "Optionally configure redacted fields and log filters.",
          notice: {
            text: "For CloudFront Web ACLs, the WAF console must be set to the Global (CloudFront) region.",
            link: {
              label: "Logging Web ACL traffic — AWS WAF docs",
              url: "https://docs.aws.amazon.com/waf/latest/developerguide/logging.html",
            },
          },
        },
        {
          title: "Create a Kinesis Data Stream (CloudFront Logs)",
          content:
            "In the Kinesis console, create a data stream (e.g. rawtree-cf-realtime) with on-demand capacity mode. " +
            "This stream will receive CloudFront real-time logs before Firehose delivers them to RawTree.",
          notice: {
            text: "On-demand mode automatically scales to match throughput — recommended for most workloads.",
            link: {
              label: "Creating a data stream — Amazon Kinesis docs",
              url: "https://docs.aws.amazon.com/streams/latest/dev/how-do-i-create-a-stream.html",
            },
          },
        },
        {
          title: "Create a Firehose Delivery Stream (CloudFront Logs)",
          content:
            "Create a second Firehose delivery stream with the Kinesis data stream as the source and " +
            "'HTTP Endpoint' as the destination. Set the endpoint URL to your RawTree cloudfront_logs table " +
            "and append a columns= query parameter listing the field names in the exact same order you selected " +
            "in the real-time log configuration (e.g. ...?transform=firehose&columns=timestamp,c-ip,sc-status,cs-uri-stem,time-taken,...). " +
            "CloudFront real-time logs are delivered as tab-separated values without a header row, so the columns " +
            "parameter tells RawTree how to map each positional field to a column name. " +
            "Use the same IAM role and S3 backup bucket.",
          codeBlock: {
            language: "text",
            code: "https://api.rawtree.com/v1/{org}/{project}/tables/cloudfront_logs?transform=firehose&columns=timestamp,c-ip,c-port,cs-method,cs-protocol,cs-protocol-version,sc-status,sc-bytes,cs-bytes,time-taken,time-to-first-byte,x-edge-location,x-edge-result-type,x-edge-response-result-type,x-edge-detailed-result-type,cs-host,cs-uri-stem,cs-user-agent,ssl-protocol,c-country",
          },
          notice: {
            text: "The order of names in the columns= parameter must exactly match the order of fields chosen in the CloudFront real-time log configuration.",
            link: {
              label: "Creating a delivery stream — Amazon Data Firehose docs",
              url: "https://docs.aws.amazon.com/firehose/latest/dev/basic-create.html",
            },
          },
        },
        {
          title: "Configure CloudFront Real-Time Log Config",
          content:
            "In the CloudFront console, go to Telemetry > Logs and create a real-time log configuration. " +
            "Select the Kinesis data stream as the endpoint, choose the fields you want to log " +
            "(timestamp, c-ip, sc-status, cs-uri-stem, time-taken, etc.), set the sampling rate (100% recommended), " +
            "and attach it to your distribution's cache behavior.",
          notice: {
            text: "Real-time logs are separate from standard CloudFront access logs — both can be enabled simultaneously.",
            link: {
              label: "Real-time logs — Amazon CloudFront docs",
              url: "https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/real-time-logs.html",
            },
          },
        },
        {
          title: "Verify & Open the Dashboard",
          content:
            "Send a few requests to your CloudFront distribution and wait 1–2 minutes for Firehose to deliver " +
            "the first batch. Check the Firehose monitoring tab to confirm records are being delivered successfully. " +
            "Then open the dashboard and connect with your RawTree API key.",
        },
      ],
    },
  ],
  publishedAt: "2026-05-19",
};
