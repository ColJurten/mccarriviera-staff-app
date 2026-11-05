# US-009 part 1 — Documenso API and desktop browser experiment

Ticket #5; ADR-0020, ADR-0010; consequence target: US-044.
Date: **2026-11-05**. This is a partial technical investigation, not approval of
US-009 or production signing. The iPhone half remains outstanding. Disposable
tooling is in [`spikes/documenso`](../../spikes/documenso/README.md); the findings
are the durable result. Story checkboxes and accepted ADRs are unchanged.

## Version and method

- Unmodified Documenso **v2.20.0** Community image; source tag resolves to
  `38ecb217effcc53a7164d7123c51336f636bd3b2`.
- Docker image digest:
  `sha256:05d2ede9fb87bfd8eedc11d81b8bdee43c3e775ea46c4fb64973153ca5ef8eb8`.
- Local PostgreSQL **17.11**, Mailpit **v1.33.0**, self-signed synthetic certificate,
  public signup disabled. No production services/customer data used.
- Renderer: Python **3.12**, Jinja2 **3.1.6**, Markdown **3.7**, Pillow **11.1.0**,
  Playwright **1.56.0** / Chromium **141.0.7390.37**; Inter and Lora fonts.
- Node **22.21.1**, pnpm **12.16.1**; the checked-in namespace helper uses
  **node:22.21.1-bookworm-slim**. Root `pnpm check` and frozen-lockfile install pass, including 31 spike
  boundary/flow tests (30 in the tester run, plus the malformed-JSON regression). Mocks are not evidence of Documenso behaviour.

The [official API guide](https://docs.documenso.com/docs/developers/api) warns that
its prose may lag the endpoints. Request shapes were checked against the
[pinned envelope router](https://github.com/documenso/documenso/tree/v2.20.0/packages/trpc/server/envelope-router)
and [meta schema](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/types/document-meta.ts),
not assumed from the older document endpoints.

## Answers and implications

| Question | Observed answer / evidence | Meaning for US-044 |
|---|---|---|
| Can the prototype produce unsigned multipage PDFs and coordinates? | **Yes, rendered locally.** `render.py --lang fr` produced 11 pages in 11.72 s; `--lang en` produced 10 pages in 7.36 s (photo generation/browser startup included). Both passed prototype overflow checks and per-page bounds/FR–EN box parity. DOM A4 blocks measured 793.6875 × 1122.515625 px. First French HTML page visually inspected in Chromium: blank departure/return boxes, synthetic identity, no clipping. | API fields use percentages from the top left of each explicit page. Keep the template/manifest hash binding. Warm rerender: 3.37 s FR / 2.72 s EN. This fixture has 12 synthetic photos; these are not production or 10/30-photo benchmarks. English terms remain pending; different page counts are expected. |
| Does one drawing populate every field without more taps? | **Scripted desktop result: one drawing alone did not populate the fields.** In Chromium 141, drawing once and confirming the pad left 10 fields remaining; clicking each of 10 fields then allowed completion. Two synthetic browser runs completed this way. Human draw/tap confirmation remains **« to confirm by hand »**. | Do not assume no per-field taps. Record draw count and taps on each page and agree any fallback with the client before US-044. |
| Can request, reminder and completion e-mails be disabled? | **Yes in this local run: 0 new placeholder messages** after create, replacement, and two scripted completions. The same baseline was retained from 18:10 to 18:21 UTC (about 11 minutes); admin reset mail was excluded. Reminder scheduling itself was not waited through for days. The create payload sets `distributionMethod: NONE`, all nine email flags false, and both reminder periods disabled. See [email derivation](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/types/document-email.ts) and [reminder settings](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/constants/envelope-reminder.ts). `mail-check` snapshots recipient-filtered IDs before and after each stage. | Use both distribution and explicit email/reminder controls, then verify create/replace/completion and a stated background-job observation interval in Mailpit before relying on suppression. |
| Is a no-mail placeholder accepted? | **Yes, accepted by the real v2 API and completed twice.** Fixture uses `spike@nomail.example.test`, a reserved test subdomain, not an actual client/domain. Creation fetched/verified the recipient and all field coordinates before returning its signing link; no production DNS claim follows. | Local API acceptance supports optional client email. Production no-mail subdomain/DNS provisioning remains separate. |
| Can a waiting envelope be replaced on a language switch? | **Yes, real FR→EN delete/create passed.** French had 11 fields and English 10. The former signing URL returned HTTP 404; the replacement opened with 10 fields remaining. It reuses the synthetic external ID, refuses completed/partially signed envelopes, preserves the old ID and records partial failure after deletion. | Public check/delete is not atomic: prevent concurrent signing/language switching or settle the race before production. There is no rollback after deletion; reconcile partial failure explicitly. |
| How is completion authenticated and the PDF downloaded? | **Genuine delivery succeeded.** The tester recorded `DOCUMENT_COMPLETED` as **SUCCESS / 200** at 18:29:08 UTC with the receiver in Documenso’s network namespace. The authenticated event saved the sealed PDF, PNG (`database-read-only`) and completion record. A duplicate returned 200 without rewriting artifacts; missing/wrong secret returned 401, wrong event 400, unrelated envelope 409. The exact shared header is `X-Documenso-Secret` (not HMAC), identity is `payload.envelopeId`, and download is `/envelope/item/{id}/download?version=signed`. Authenticated malformed JSON now returns 400 without processing. | Re-fetch ownership and completed state; persist PDF/hash before business transitions. Genuine delivery and receiver processing are established locally; retain retry/idempotency and never trust the webhook body alone. |
| Can callbacks reach a local receiver? | **Yes with the tested network-namespace route.** `callback-container.sh` runs the receiver beside Documenso in the same network namespace, with a loopback-only `5432` forward to `postgres:5432` for image extraction. `spike-callback.test` maps to `127.0.0.1` and is the only runtime-allowed callback hostname. Registration rejects literal private/loopback IP URLs. The optional host-bridge path failed on this host: **four** 10-second timeout attempts at 18:19:18, :28, :38 and :48 UTC, plus a separate TCP probe. These were host-network reachability failures, not a Documenso/receiver failure. [Pinned URL check](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/server-only/webhooks/assert-webhook-url.ts). | Use the documented namespace helper when host firewall rules prevent the bridge route. No public port, public tunnel, firewall change or signing-image patch is required. Verify 401 on a preflight unauthenticated POST and SUCCESS / 200 after signing. |
| Can the signature image be read back? | **Yes via the real local DB; public API omitted the image.** Public get-envelope/get-field schemas omit the signature relation. `getEnvelopeFieldSignatures` exists only as internal session tRPC. The receiver requests the public field first, then uses an optional parameterized read-only query joining `Signature`, `Field`, `Recipient` and `Envelope` scoped to this completed run. The genuine tester callback saved a readable PNG via `database-read-only` (the earlier replay image was 920 × 400); missing-image/failure boundaries also pass with mocks. | Plan for version-sensitive DB access unless a supported public endpoint is established. Keep image and hash tied to the sealed departure evidence. A typed/missing image or failed DB query must be reported as unavailable, not fabricated. |
| Does the sealed PDF have an intact PAdES seal and detect changes? | **« to confirm by hand »** in Adobe Reader, including a separately modified copy and untrusted self-signed identity. The downloaded result was 1,266,470 bytes / 11 pages (10 contract + audit page), with a `ByteRange` and `ETSI.CAdES.detached` SubFilter. These structural observations do not replace seal verification. | Legal sufficiency (L-01/US-092) remains external; retain the sealed departure original as proof. |
| Is desktop embedding or a new tab preferable? | **New tab opened; plain iframe remained empty in the scripted Chromium harness.** Top-level signing completed. Human cross-browser usability remains **« to confirm by hand »**; iframe operation is not established. | Settle desktop behaviour before designing US-044. The iPhone web view/cleanup/sharing/phone timings belong to part 2. |

## Reproduction and retained evidence

Follow the [runbook](../../spikes/documenso/README.md) in order: render FR/EN;
start the local stack and check certificate; create team/token in the UI; set
external secret-file paths; configure callback; run `mail-check -- --baseline`;
`run create -- --lang fr`; `mail-check`; `replace -- --lang en`; `mail-check`;
check old link; open the harness; sign by hand; inspect completion artifacts;
`mail-check` again; inspect the PDF in Adobe Reader. Keep the receiver bounded
with `timeout 300` and renew as needed.

Generated output is ignored and contains capabilities; never commit it. Record
sanitized results here, including mail counts at every stage and elapsed
observation windows, rather than tokens, signing links or webhook bodies.
The spike's unit suite checks validation, API rejection, replacement refusal/
partial failure, secret/event/envelope/status checks, concurrent duplicate
handling, extraction fallback and Mailpit recipient filtering/pagination.
No actual signing observation can be inferred from those tests.

The scripted browser experiment above ran against the real unmodified service,
using synthetic zigzag strokes, not a person's signature. It is independent of
the mocks. Generated artifacts remain ignored. Independently checked tester artifacts from genuine delivery:

- Sealed PDF SHA-256: `720109ed5910377edb7c313e2eea60444171ca57ff8f145b7d36144591fbc6bf`.
- Signature PNG SHA-256: `2a0fae0430ddfae609c170432ae8dacb990e92104ba0972a1338cb24d4e31d84`.

The initial host-bridge attempt failed before application processing; its replay
only established processing. The later tester run established **genuine
Documenso delivery**, with SUCCESS / 200 recorded in `WebhookCall`, and saved the
artifacts above. A duplicate left them unchanged. The sealed PDF has 11 pages,
one `ByteRange` and `ETSI.CAdES.detached`; a 72 dpi raster comparison found the
same synthetic drawing in all 10 departure boxes (273 dark pixels each).
This structural/image evidence does not verify the digital seal in Adobe.
Mailpit in the tester run showed 0 new placeholder messages after each phase
and 0 messages across all recipients during its roughly two-minute window.
The earlier coder run observed 0 new placeholder messages across about 11 minutes.
Neither run waited days for reminder jobs.

The rework run repeated genuine delivery using the checked-in
`callback-container.sh` and Node 22.21.1. The preflight POST returned 401;
Documenso recorded SUCCESS / 200 at **18:38:19 UTC**, and the receiver saved a
1,268,496-byte PDF plus a readable 920 × 400 PNG via `database-read-only`.
A duplicate returned 200 with all three artifact modification times unchanged;
malformed authenticated JSON returned 400. Mailpit again reported 0 new
placeholder messages. Rework hashes:

- Sealed PDF SHA-256: `755f240ab7b3836f7517effdd4695bbb84a0fbd2dcc4ddb213e65451432435d4`.
- Signature PNG SHA-256: `b26a2e011336798a3217777491be0ab4be8a06cba8f96677e3c184ded8f35d4a`.

The plain iframe returned no visible content within the coder's harness
observation; its cause was not established. Top-level signing worked.

## Remaining gates

- The optional host-bridge route remains unreachable on this host; the documented
  network-namespace route closes the local callback delivery gate. Production
  callback routing still needs its own deployment verification in US-043/US-044.
- One human drawing, per-field/page taps, tab/iframe behaviour and Adobe Reader:
  **« to confirm by hand »**.
- The full story's 30-photo/amendment stress case, homelab and iPhone tests are
  outside ticket #5's server/browser tooling slice and remain incomplete.
- A material failure requires a developer/client decision before US-044; this
  experiment does not revise ADR-0020 or silently choose DocuSeal/per-page taps.
