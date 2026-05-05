"""
GCP Documentation Downloader
==============================
Downloads key GCP documentation pages for the RAG knowledge base.
Run this ONCE, then ingest into Pinecone.

Usage:
    python download_docs.py
    # OR run the shell command below in bash/WSL
"""
import os
import sys
import subprocess

# Target directory
DATA_DIR = os.path.join(os.path.dirname(__file__), "..", "data")
GCP_DOCS_DIR = os.path.join(DATA_DIR, "gcp_docs")
BEST_PRACTICES_DIR = os.path.join(DATA_DIR, "best_practices")

# ─── Key GCP Documentation URLs ─────────────────────────────────
# These are the most important pages for our support panel + billing

GCP_DOC_URLS = [
    # Compute Engine
    "https://cloud.google.com/compute/docs/machine-resource",
    "https://cloud.google.com/compute/docs/regions-zones",
    "https://cloud.google.com/compute/docs/instances/create-start-instance",
    "https://cloud.google.com/compute/docs/instances/stop-start-instance",
    "https://cloud.google.com/compute/docs/disks",
    "https://cloud.google.com/compute/docs/troubleshooting/troubleshooting-instances",

    # Cloud Storage
    "https://cloud.google.com/storage/docs/introduction",
    "https://cloud.google.com/storage/docs/storage-classes",
    "https://cloud.google.com/storage/docs/creating-buckets",
    "https://cloud.google.com/storage/docs/access-control",

    # VPC / Networking
    "https://cloud.google.com/vpc/docs/overview",
    "https://cloud.google.com/vpc/docs/firewalls",
    "https://cloud.google.com/vpc/docs/subnets",
    "https://cloud.google.com/load-balancing/docs/load-balancing-overview",

    # BigQuery
    "https://cloud.google.com/bigquery/docs/introduction",
    "https://cloud.google.com/bigquery/docs/best-practices-costs",
    "https://cloud.google.com/bigquery/pricing",

    # IAM
    "https://cloud.google.com/iam/docs/overview",
    "https://cloud.google.com/iam/docs/understanding-roles",
    "https://cloud.google.com/resource-manager/docs/creating-managing-projects",

    # Billing
    "https://cloud.google.com/billing/docs/concepts",
    "https://cloud.google.com/billing/docs/how-to/budgets",
    "https://cloud.google.com/billing/docs/how-to/export-data-bigquery",

    # Cost Optimization (critical for billing audits)
    "https://cloud.google.com/architecture/framework/cost-optimization",
    "https://cloud.google.com/architecture/framework/cost-optimization/monitor",
    "https://cloud.google.com/architecture/framework/cost-optimization/optimize-cost",
    "https://cloud.google.com/compute/docs/instances/viewing-sizing-recommendations-for-instances",

    # Support & Troubleshooting
    "https://cloud.google.com/support/docs/issue-trackers",
    "https://cloud.google.com/compute/docs/troubleshooting",
]

BEST_PRACTICES_URLS = [
    "https://cloud.google.com/architecture/framework",
    "https://cloud.google.com/architecture/framework/security",
    "https://cloud.google.com/architecture/framework/reliability",
    "https://cloud.google.com/architecture/framework/performance-optimization",
    "https://cloud.google.com/architecture/framework/operational-excellence",
]


def generate_wget_command() -> str:
    """
    Generate a single long wget command to download all GCP docs.
    User can copy-paste this into WSL/bash/Git Bash.
    """
    docs_dir = "data/gcp_docs"
    practices_dir = "data/best_practices"

    commands = []
    commands.append(f"mkdir -p {docs_dir} {practices_dir}")

    # GCP docs
    for url in GCP_DOC_URLS:
        # Create filename from URL
        fname = url.replace("https://cloud.google.com/", "").replace("/", "_").rstrip("_") + ".html"
        commands.append(
            f'wget -q -O {docs_dir}/{fname} '
            f'--header="User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" '
            f'"{url}" 2>/dev/null && echo "  ✓ {fname}" || echo "  ✗ {fname} (failed)"'
        )

    # Best practices
    for url in BEST_PRACTICES_URLS:
        fname = url.replace("https://cloud.google.com/", "").replace("/", "_").rstrip("_") + ".html"
        commands.append(
            f'wget -q -O {practices_dir}/{fname} '
            f'--header="User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" '
            f'"{url}" 2>/dev/null && echo "  ✓ {fname}" || echo "  ✗ {fname} (failed)"'
        )

    return " && \\\n".join(commands)


def generate_powershell_command() -> str:
    """
    Generate PowerShell commands for Windows users.
    """
    docs_dir = "data\\gcp_docs"
    practices_dir = "data\\best_practices"

    lines = []
    lines.append(f'New-Item -ItemType Directory -Force -Path "{docs_dir}", "{practices_dir}" | Out-Null')
    lines.append('$headers = @{"User-Agent" = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}')

    for url in GCP_DOC_URLS:
        fname = url.replace("https://cloud.google.com/", "").replace("/", "_").rstrip("_") + ".html"
        lines.append(
            f'try {{ Invoke-WebRequest -Uri "{url}" -Headers $headers -OutFile "{docs_dir}\\{fname}" -ErrorAction Stop; '
            f'Write-Host "  ✓ {fname}" }} catch {{ Write-Host "  ✗ {fname} (failed)" }}'
        )

    for url in BEST_PRACTICES_URLS:
        fname = url.replace("https://cloud.google.com/", "").replace("/", "_").rstrip("_") + ".html"
        lines.append(
            f'try {{ Invoke-WebRequest -Uri "{url}" -Headers $headers -OutFile "{practices_dir}\\{fname}" -ErrorAction Stop; '
            f'Write-Host "  ✓ {fname}" }} catch {{ Write-Host "  ✗ {fname} (failed)" }}'
        )

    return "\n".join(lines)


if __name__ == "__main__":
    print("=" * 70)
    print("GCP DOCUMENTATION DOWNLOADER")
    print("=" * 70)
    print(f"\nTotal URLs: {len(GCP_DOC_URLS)} GCP docs + {len(BEST_PRACTICES_URLS)} best practices")
    print(f"\nTarget directories:")
    print(f"  GCP Docs:       {os.path.abspath(GCP_DOCS_DIR)}")
    print(f"  Best Practices: {os.path.abspath(BEST_PRACTICES_DIR)}")

    print("\n" + "=" * 70)
    print("OPTION 1: PowerShell (Windows) — copy-paste below:")
    print("=" * 70)
    print()
    print(generate_powershell_command())

    print("\n" + "=" * 70)
    print("OPTION 2: Bash/WSL/Git Bash — copy-paste below:")
    print("=" * 70)
    print()
    print(generate_wget_command())

    print("\n" + "=" * 70)
    print("After downloading, run:")
    print("  cd ai && python -m rag.embed --source all")
    print("=" * 70)
