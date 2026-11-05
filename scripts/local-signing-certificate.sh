#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${LOCAL_SECRETS_DIR:?Set LOCAL_SECRETS_DIR to an absolute directory outside the checkout}"
repo=$(git rev-parse --show-toplevel)
common_repo=$(dirname "$(git rev-parse --path-format=absolute --git-common-dir)")
dir=$(realpath -m "$LOCAL_SECRETS_DIR")
case "$dir/" in "$common_repo/"*) echo 'Secrets directory must be outside the repository' >&2; exit 1;; esac
case "$dir/" in "$repo/"*) echo 'Secrets directory must be outside the checkout' >&2; exit 1;; esac
mkdir -p "$dir"
chmod 700 "$dir"
if [[ "${1:-}" == --check ]]; then
  openssl pkcs12 -in "$dir/cert.p12" -passin "file:$dir/signing-passphrase" -noout >/dev/null 2>&1
  printf 'Local signing certificate configured (passphrase verified).\n'
  exit
fi
if [[ -e "$dir/cert.p12" || -e "$dir/signing-passphrase" ]]; then
  echo 'Certificate material already exists; refusing to overwrite' >&2; exit 1
fi
openssl rand -hex 32 > "$dir/signing-passphrase"
work=$(mktemp -d "$dir/certificate.XXXXXX")
trap 'rm -rf "$work"' EXIT
openssl req -x509 -newkey rsa:3072 -sha256 -days 365 -nodes \
  -subj '/CN=Synthetic Local Signing/O=Local Development Only/C=FR' \
  -keyout "$work/key.pem" -out "$work/cert.pem" >/dev/null 2>&1
openssl pkcs12 -export -out "$dir/cert.p12" -inkey "$work/key.pem" -in "$work/cert.pem" \
  -passout "file:$dir/signing-passphrase"
# Documenso's unmodified image runs as UID 1001. The private parent directory
# stays 700; the certificate alone must be readable after a direct bind mount.
chmod 644 "$dir/cert.p12"
printf 'Synthetic local certificate created outside the checkout.\n'
