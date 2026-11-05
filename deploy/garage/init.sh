#!/bin/sh
set -eu
# A fixed single-node local layout. Existing nonzero layouts are left intact.
if /garage layout show | grep -q 'Current cluster layout version: 0'; then
  node_id=$(/garage node id | cut -d@ -f1)
  /garage layout assign -z local -c 1G "$node_id" >/dev/null
  /garage layout apply --version 1 >/dev/null
fi
if ! /garage key info "$S3_ACCESS_KEY_ID" >/dev/null 2>&1; then
  /garage key import "$S3_ACCESS_KEY_ID" "$S3_SECRET_ACCESS_KEY" -n mcr-local-api --yes >/dev/null
fi
for bucket in condition-photos client-documents signatures contract-pdfs documenso; do
  if ! /garage bucket info "$bucket" >/dev/null 2>&1; then
    /garage bucket create "$bucket" >/dev/null
  fi
  if [ "$bucket" != documenso ]; then
    /garage bucket allow --read --write "$bucket" --key "$S3_ACCESS_KEY_ID" >/dev/null
  fi
done
printf 'Garage local buckets and API grants configured.\n'
