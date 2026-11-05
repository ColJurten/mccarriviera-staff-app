# US-009 part 1: disposable Documenso experiment

Implements ticket #5's server/browser experiment under ADR-0020 and ADR-0010.
This is **not production integration**. Keep the findings; remove this tooling
when the experiment is finished. No app/API routes, business migrations, accepted
ADRs or prototype assets are changed. The workspace joins root checks but has
no build script and is excluded from the production Docker context.

## Render the unsigned synthetic specimen

From the repository root, use Node 22.21.1 and pnpm 12.16.1 (`pnpm install`).
Install Python 3.12 with venv, Inter (regular/semibold) and Lora fonts, then:

```sh
python3 -m venv spikes/documenso/.venv
spikes/documenso/.venv/bin/pip install -r spikes/documenso/requirements.txt
spikes/documenso/.venv/bin/playwright install --with-deps chromium
timeout 300 spikes/documenso/.venv/bin/python spikes/documenso/render.py --lang fr
timeout 300 spikes/documenso/.venv/bin/python spikes/documenso/render.py --lang en
```

`playwright install --with-deps` needs administrator rights for the OS libraries.
On a host without those rights, have the libraries provisioned first, then run
`playwright install chromium` as the normal user.

The prototype's image helper expects Inter under `/usr/share/fonts/opentype/inter`.
Alternatively set `SPIKE_FONT_DIR` to a directory holding `Inter-Regular.otf`,
`Inter-SemiBold.otf`, `Lora-Regular.ttf`; the renderer then loads those files for
both the pictures and Chromium. The prototype module/template are imported,
never edited. Only its documented invented specimen fields are reused; company
identity is synthetic. Photos are generated, and **no specimen signatures** are
created or embedded. Departure-only pages have empty signature images/dates.
English is an experimental specimen with pending approved terms (R-17), not an
approved translation. No amendment pages get departure fields.

`output/departure-{fr,en}.{html,pdf,json}` contains explicit A4 pages and a
SHA-256-bound manifest. Coordinates are measured from the blank departure image
area of each rendered page, as percentages from the top left (not PDF points).
French/English may have different page counts because English terms are pending;
every page's box must have the same coordinates. Overflow fails rendering.
Open both PDFs visually before uploading. All HTML, photos, PDFs, state, signing
links, mail snapshots and evidence stay under ignored `output/`. Do not commit
or share that folder; signing URLs are bearer capabilities.

## Local stack and external configuration

Follow [deploy/README.md](../../deploy/README.md) for the pinned unmodified
Documenso **v2.20.0**, PostgreSQL **17.11**, Mailpit **v1.33.0**, external
configuration, certificate check, admin bootstrap and password-reset mail.
Keep public signup disabled. Never print/source secret-bearing values into
logs. For this experiment use an isolated disposable local stack only.

In Documenso's browser UI, sign in as the synthetic admin, create an organisation
and team if absent, select that team, then create a team-scoped API token under
its settings/API tokens. Save the token alone in a mode-600 file outside **every
checkout**. Create another random secret file for the webhook, using a private
editor or `openssl rand -hex 32 > <external-file>` with `umask 077`; enter the
same secret in the team's webhook settings. Do not put secret values in shell
arguments, this README, screenshots or `.env` files in the repository.

```sh
export DOCUMENSO_TOKEN_FILE="$HOME/.local/state/mcr-local/spike-token"
export DOCUMENSO_WEBHOOK_SECRET_FILE="$HOME/.local/state/mcr-local/spike-webhook-secret"
# Optional fallback: file containing a loopback PostgreSQL connection URL for
# the disposable documenso database, preferably a SELECT-only local user.
export DOCUMENSO_DB_URL_FILE="$HOME/.local/state/mcr-local/spike-db-url"
```

The default origins are `http://localhost:3000` and `http://localhost:8025`;
`DOCUMENSO_URL` and `MAILPIT_URL` can change loopback ports only. The DB connection
must target `/documenso` on loopback. It uses `BEGIN READ ONLY`, a five-second
statement timeout and parameters scoped to the tracked envelope/external ID/
recipient. Never point it at the app DB, staging or production.

## Local callback without host firewall rules (tested route)

Run the receiver in a disposable container sharing Documenso's network
namespace. This avoids container-to-host bridge/firewall restrictions; nothing
is published. From the repository root, after the local stack is healthy:

```sh
# The callback hostname resolves to loopback INSIDE Documenso's namespace.
export SPIKE_CALLBACK_HOST=127.0.0.1
docker compose --env-file "$LOCAL_ENV_FILE" -f deploy/compose.local.yml \
  -f spikes/documenso/compose.callback.yml up -d --no-deps --wait documenso
# Keep this running in a separate terminal while signing:
timeout 180 docker pull node:22.21.1-bookworm-slim
bash spikes/documenso/callback-container.sh
```

Set the three external secret-file variables from the preceding section first.
For this route, the DB URL file is required for the image-retrieval experiment
and must contain the disposable `documenso` connection URL with host
`127.0.0.1` and port `5432`. Create that mode-600 file with a private editor;
do not print its credentials. The helper forwards only its namespace's
`127.0.0.1:5432` to the existing Compose `postgres:5432` service. The API calls
use `127.0.0.1:3000`, also inside that namespace. This does not change the DB
URL used by Documenso itself or the app's database.

The helper mounts this checkout (for code, installed pnpm dependencies and
ignored output), the three individual external secret files read-only, and uses the
pinned **node:22.21.1-bookworm-slim** runtime image. It runs as your host UID/GID;
the signing service/image remain unmodified. It starts the loopback
DB forward and receiver, bounds the session to five minutes and stops its own
container on exit. Re-run the helper if manual signing takes longer. Stop it
before recreating the signing container, since it shares that container's
network namespace. `SPIKE_DOCUMENSO_CONTAINER` can override the default
`mcr-local-documenso-1` when using another local Compose project name.

In the team's webhook UI register `http://spike-callback.test:3210/webhook`,
select **document.completed** (`DOCUMENT_COMPLETED` on the wire), set the same
shared secret and wait for the **Webhook created** notification. Confirm the
saved row is enabled before signing. The local override maps that hostname to
`127.0.0.1` in Documenso and configures the pinned release's
`NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS` for that exact hostname. Registration
rejects literal private/loopback IP URLs even with the runtime allow-list.
This is local configuration, not a public tunnel, firewall change or a patch.

Before signing, probe from the signing container; an unauthenticated POST must
return **401** (not timeout):

```sh
timeout 10 docker exec mcr-local-documenso-1 node -e '
fetch("http://spike-callback.test:3210/webhook", {
  method: "POST", signal: AbortSignal.timeout(5000)
}).then(r => { console.log(r.status); if (r.status !== 401) process.exitCode = 1; })
.catch(() => { console.error("Callback unreachable"); process.exitCode = 1; });'
```

After signing, Documenso's webhook-call history must show **SUCCESS / 200** and
the ignored output folder must contain the sealed PDF, signature PNG and
completion record. A local event replay alone does not verify genuine delivery.
The network-namespace route passed this check in the tester run.

### Optional receiver on the host

When the Docker network permits container-to-host connections, the original
host route is also available. Set `SPIKE_CALLBACK_HOST` to the existing
`mcr-local_default` network's host bridge gateway, reapply the callback override,
and run `timeout 300 pnpm --filter @mccarriviera/documenso-spike webhook` on the
host, bound only to that private interface. Inspect the gateway with
`docker network inspect mcr-local_default --format '{{(index .IPAM.Config 0).Gateway}}'`.
Use the same hostname and 401 probe. This route timed out on this host, so use
the tested namespace route above instead of changing firewall rules. A receiver
on host loopback alone works when Documenso also runs directly on the host.

## Create, replace, sign, inspect

With the local receiver running in another terminal:

```sh
timeout 60 pnpm --filter @mccarriviera/documenso-spike mail-check -- --baseline
timeout 300 pnpm --filter @mccarriviera/documenso-spike run create -- --lang fr
timeout 60 pnpm --filter @mccarriviera/documenso-spike mail-check
timeout 300 pnpm --filter @mccarriviera/documenso-spike replace -- --lang en
timeout 60 pnpm --filter @mccarriviera/documenso-spike mail-check
```

Create uploads multipart `payload` and `files` to API v2 `/envelope/create`:
one `SIGNER` (`spike@nomail.example.test`), one `SIGNATURE` per input page,
`distributionMethod: NONE`, all nine e-mail flags false and both reminder
periods disabled. It fetches the envelope to check ownership, exact fields and
mail flags, then `/envelope/distribute` returns the signing URL, printed locally.
The reserved `.test` address checks API acceptance without sending real mail;
it does not validate the company's eventual no-mail DNS configuration.

Only one run is tracked at a time; create refuses existing state. Replacement
validates the target fixture, checks that signing has not begun, deletes the
old envelope, confirms it is missing/deleted, and creates the other language with
the same synthetic external reference. Keep the old link locally and verify in
a private tab that it cannot sign after deletion. Do not sign concurrently with
replacement: the public API offers no atomic check-and-delete guarantee. US-044
must resolve this race before implementation. Completed/partially signed
envelopes are refused by this tool.

`creation.json` preserves a created ID if later steps fail. `replacement.json`
and deleted `state.json` identify partial failure after deletion; do not retry
blindly or claim rollback. Inspect the team UI and archive local output before
starting a new run. A failure before the create API returns an ID may also leave
an untracked envelope; reconcile in the synthetic team's UI.

Open the printed URL in a private desktop browser. Open `browser.html` locally
for the new-tab/iframe comparison (no token, no persistent storage in the
harness). Record browser/version, draw count, taps for each page/field, total
time, errors, and whether iframe/new-tab succeeded. Do not substitute scripted
drawing for a person's confirmation. After completion rerun `mail-check` and
open Mailpit at http://localhost:8025; search `to:spike@nomail.example.test`.
Compare every phase with the same baseline; wait for background mail jobs and
record the observation interval. Setup/password-reset mail goes to
`admin@example.test` and is excluded. Mailpit must retain its baseline messages;
missing baseline mail invalidates comparison. A zero count establishes only
that observation window, not every future scheduled task.

The receiver authenticates `X-Documenso-Secret` (a shared header, not HMAC),
checks the event/envelope against local state and re-fetches completed status,
signer and ownership. Wrong/unrelated requests cause no artifact writes or
downloads; transient errors return 503 for retry. Concurrent duplicates are
serialized and successful delivery gets an envelope-specific completion marker.
A failed extraction is explicitly recorded, never invented.

After genuine completion, `output/<hashed-envelope-id>-sealed.pdf` and a
completion JSON record contain the sealed PDF hash, time, retrieval method and
signature hash. The public API's field response omits the image in v2.20.0; the
receiver attempts that API first, then the optional read-only DB fallback through
`Signature` → `Field`/`Recipient`/`Envelope`. A drawn PNG is saved as
`<hashed-envelope-id>-signature.png`. Internal session-only tRPC is not treated
as a public API. A missing DB configuration or typed/missing image produces an
explicit `unavailable` outcome. Downloading a PDF does not establish its seal.

Open the result in Adobe Reader: intact seal, untrusted self-signed identity,
then detected change in a separately modified copy — **« to confirm by hand »**.
One drawing/all-fields behaviour and desktop tap counts are also
**« to confirm by hand »**. iPhone, Files/Mail/WhatsApp sharing and private web
view cleanup are part 2 and remain outstanding.

## Validation and evidence

```sh
timeout 300 pnpm check
timeout 300 pnpm install --frozen-lockfile
```

The mock tests validate boundaries, not real Documenso behaviour. Record actual
version/date, rendering, API responses (sanitized), mail counts per phase,
replacement/old-link behaviour, browser observations, callback/download/image
outcomes and Adobe checks in [findings](../../docs/spikes/US-009-findings.md).
Never include API tokens, callback secrets, credentials, complete webhook bodies
(they include signer tokens) or signing URLs. Keep US-009 checkboxes unchanged.
