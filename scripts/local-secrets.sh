#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${LOCAL_SECRETS_DIR:?Set LOCAL_SECRETS_DIR to an absolute directory outside the checkout}"
repo=$(git rev-parse --show-toplevel)
common_repo=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
dir=$(realpath -m "$LOCAL_SECRETS_DIR")
case "$dir/" in "$common_repo/"*) echo 'Secrets directory must be outside the repository' >&2; exit 1;; esac
case "$dir/" in "$repo/"*) echo 'Secrets directory must be outside the checkout' >&2; exit 1;; esac
# Compose env-file parsing and shell sourcing must agree on the path.
[[ "$dir" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Use a path without spaces or shell characters' >&2; exit 1; }
mkdir -p "$dir"
chmod 700 "$dir"
[[ ! -e "$dir/local.env" ]] || { echo 'local.env already exists; refusing to overwrite' >&2; exit 1; }
export LOCAL_SECRETS_DIR="$dir"
if [[ ! -e "$dir/cert.p12" ]]; then bash scripts/local-signing-certificate.sh; fi
bash scripts/local-signing-certificate.sh --check
random() { openssl rand -hex 32; }
mcr_password=$(random)
doc_password=$(random)
cat > "$dir/local.env" <<ENV
LOCAL_SECRETS_DIR=$dir
POSTGRES_PASSWORD=$(random)
MCR_DB_PASSWORD=$mcr_password
DOCUMENSO_DB_PASSWORD=$doc_password
DATABASE_URL=postgresql://mcr:$mcr_password@localhost:5432/mcr?sslmode=disable
DOCUMENSO_DATABASE_URL=postgresql://documenso:$doc_password@postgres:5432/documenso
GARAGE_RPC_SECRET=$(random)
S3_ACCESS_KEY_ID=GK$(openssl rand -hex 12)
S3_SECRET_ACCESS_KEY=$(random)
S3_ENDPOINT=http://localhost:3900
S3_REGION=garage
S3_HEALTH_BUCKET=condition-photos
API_PORT=3001
HEALTH_TIMEOUT_MS=1500
NEXTAUTH_SECRET=$(random)
NEXT_PRIVATE_ENCRYPTION_KEY=$(random)
NEXT_PRIVATE_ENCRYPTION_SECONDARY_KEY=$(random)
NEXT_PRIVATE_SIGNING_PASSPHRASE=$(cat "$dir/signing-passphrase")
ENV
printf 'Local configuration created outside the checkout (no values printed).\n'
