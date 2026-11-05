#!/usr/bin/env bash
# Disposable local receiver in Documenso's network namespace; no published ports.
set -euo pipefail
: "${DOCUMENSO_TOKEN_FILE:?Set the external token file path}"
: "${DOCUMENSO_WEBHOOK_SECRET_FILE:?Set the external webhook secret file path}"
: "${DOCUMENSO_DB_URL_FILE:?Set the external loopback Documenso DB URL file path}"
[[ $(node --version) == v22.21.1 ]] || { echo 'Use Node 22.21.1 first' >&2; exit 1; }
# Validate original host paths before remapping files into /spike-secrets.
for spike_secret in "$DOCUMENSO_TOKEN_FILE" "$DOCUMENSO_WEBHOOK_SECRET_FILE" "$DOCUMENSO_DB_URL_FILE"; do
  [[ "$spike_secret" = /* && -f "$spike_secret" ]] || { echo 'Use absolute external secret-file paths' >&2; exit 1; }
  [[ $(stat -Lc %a "$spike_secret") == 600 ]] || { echo 'Secret files must have mode 600' >&2; exit 1; }
  spike_parent=$(dirname "$(realpath "$spike_secret")")
  while [[ "$spike_parent" != / ]]; do
    [[ ! -e "$spike_parent/.git" ]] || { echo 'Keep secret files outside every checkout' >&2; exit 1; }
    spike_parent=$(dirname "$spike_parent")
  done
done
spike_checkout=$(git rev-parse --show-toplevel)
spike_container=${SPIKE_DOCUMENSO_CONTAINER:-mcr-local-documenso-1}
spike_tmp=$(mktemp -d)
cleanup() {
  if [[ -s "$spike_tmp/container-id" ]]; then
    timeout 15 docker stop "$(cat "$spike_tmp/container-id")" >/dev/null 2>&1 || true
  fi
  rm -f "$spike_tmp/container-id"
  rmdir "$spike_tmp"
}
trap cleanup EXIT
# Use a pinned Node runtime independently of the upstream signing image.
# Files remain at their checkout paths so pnpm's workspace links still resolve.
timeout 300 docker run --rm --init -i --cidfile "$spike_tmp/container-id" \
  --network "container:$spike_container" --user "$(id -u):$(id -g)" \
  --mount "type=bind,src=$spike_checkout,dst=$spike_checkout" \
  --mount "type=bind,src=$DOCUMENSO_TOKEN_FILE,dst=/spike-secrets/token,readonly" \
  --mount "type=bind,src=$DOCUMENSO_WEBHOOK_SECRET_FILE,dst=/spike-secrets/webhook,readonly" \
  --mount "type=bind,src=$DOCUMENSO_DB_URL_FILE,dst=/spike-secrets/database,readonly" \
  --workdir "$spike_checkout/spikes/documenso" \
  -e DOCUMENSO_URL=http://127.0.0.1:3000 \
  -e SPIKE_CALLBACK_HOST=127.0.0.1 \
  -e DOCUMENSO_TOKEN_FILE=/spike-secrets/token \
  -e DOCUMENSO_WEBHOOK_SECRET_FILE=/spike-secrets/webhook \
  -e DOCUMENSO_DB_URL_FILE=/spike-secrets/database \
  --entrypoint /bin/sh node:22.21.1-bookworm-slim <<'CONTAINER'
node --input-type=module -e '
import { createServer, connect } from "node:net";
createServer(client => {
  const upstream = connect(5432, "postgres");
  client.pipe(upstream).pipe(client);
  client.on("error", () => upstream.destroy());
  upstream.on("error", () => client.destroy());
  client.on("close", () => upstream.destroy());
  upstream.on("close", () => client.destroy());
}).listen(5432, "127.0.0.1");
' &
proxy_pid=$!
node --import tsx src/webhook.ts &
receiver_pid=$!
trap 'kill "$proxy_pid" "$receiver_pid" 2>/dev/null' EXIT INT TERM
wait "$receiver_pid"
CONTAINER
