#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'USAGE'
Usage: run-and-publish.sh --storage-account <name> [options]

Options:
  -i, --case-study <path>      Path to the case study text file (default: case-study.txt)
      --staging-dir <path>     Local directory for staging published artefacts (default: output/poc-publish)
      --artifact-container <c> Blob container for public artefacts (default: final-artifacts)
      --skip-status            Skip running npm run status before the analysis
  -h, --help                   Show this help message

Environment:
  Uses Azure CLI authentication (az login) to push artefacts to Storage.
USAGE
}

if ! command -v az >/dev/null 2>&1; then
  echo "Azure CLI (az) is required to publish artefacts." >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  echo "Node.js tooling (npx) is required to run the agentic pipeline." >&2
  exit 1
fi

case_study='case-study.txt'
staging_root='output/poc-publish'
artifact_container='final-artifacts'
skip_status=false
storage_account=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    -i|--case-study)
      case_study="$2"
      shift 2
      ;;
    --staging-dir)
      staging_root="$2"
      shift 2
      ;;
    --artifact-container)
      artifact_container="$2"
      shift 2
      ;;
    --storage-account)
      storage_account="$2"
      shift 2
      ;;
    --skip-status)
      skip_status=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown option: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if [[ -z "$storage_account" ]]; then
  echo "Missing required option: --storage-account" >&2
  usage
  exit 1
fi

if [[ ! -f "$case_study" ]]; then
  echo "Case study file not found: $case_study" >&2
  exit 1
fi

if [[ "$skip_status" = false ]]; then
  npm run status || true
fi

rm -rf "$staging_root"
mkdir -p "$staging_root"

npx tsx src/cli/poc-runner.ts --input "$case_study" --copy-to "$staging_root"

latest_folder=$(ls -td "$staging_root"/* 2>/dev/null | head -n1 || true)
if [[ -z "$latest_folder" ]]; then
  echo "Failed to locate generated output folder in $staging_root" >&2
  exit 1
fi

echo "Uploading artefacts from $latest_folder to container $artifact_container..."

az storage blob upload-batch \
  --account-name "$storage_account" \
  --auth-mode login \
  --destination "$artifact_container" \
  --source "$latest_folder" \
  --overwrite >/dev/null

export LATEST_FOLDER="$latest_folder"
export STORAGE_ACCOUNT="$storage_account"
export ARTIFACT_CONTAINER="$artifact_container"
export INDEX_FILE="$staging_root/index.html"

python3 - <<'PY'
import os
import html
from pathlib import Path

staging = Path(os.environ['LATEST_FOLDER'])
account = os.environ['STORAGE_ACCOUNT']
container = os.environ['ARTIFACT_CONTAINER']
index_path = Path(os.environ['INDEX_FILE'])

items = []
for path in staging.rglob('*'):
    if path.is_file():
        rel_path = path.relative_to(staging)
        blob_path = '/'.join(rel_path.parts)
        href = f"https://{account}.blob.core.windows.net/{container}/{blob_path}"
        items.append((str(rel_path), href))

items.sort()
index_path.write_text("""<!DOCTYPE html>
<html lang=\"en\">
<head>
  <meta charset=\"utf-8\"/>
  <title>Agentic PoC Case Study Outputs</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 2rem; }
    h1 { margin-bottom: 1rem; }
    li { margin: 0.3rem 0; }
  </style>
</head>
<body>
  <h1>Case Study Outputs</h1>
  <p>Generated artefacts are stored in a public blob container so stakeholders can download without authentication.</p>
  <ul>
""", encoding='utf-8')

with index_path.open('a', encoding='utf-8') as f:
    for label, href in items:
        f.write(f"    <li><a href='{html.escape(href)}'>{html.escape(label)}</a></li>\n")
    f.write("""  </ul>
</body>
</html>
""")
PY

echo "Publishing index.html to static website..."

az storage blob upload \
  --account-name "$storage_account" \
  --auth-mode login \
  --container-name '$web' \
  --name index.html \
  --file "$INDEX_FILE" \
  --overwrite >/dev/null

static_endpoint=$(az storage account show \
  --name "$storage_account" \
  --query "primaryEndpoints.web" \
  -o tsv)

if [[ -z "$static_endpoint" ]]; then
  static_endpoint='(static website endpoint not yet available – check that static website hosting is enabled)'
fi

cat <<EOF
✅ Publish complete.
Blob artefacts: https://${storage_account}.blob.core.windows.net/${artifact_container}/
Static index:   ${static_endpoint}
EOF
