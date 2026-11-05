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
- Node **22.21.1**, pnpm **12.16.1**. Root `pnpm check` and frozen-lockfile install pass, including 18 spike
  boundary tests. Mocks are not evidence of Documenso behaviour.

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
| How is completion authenticated and the PDF downloaded? | **Pinned source:** `X-Documenso-Secret`, exact shared secret, not an HMAC. Event payload uses `payload.envelopeId`. Public download is `/envelope/item/{id}/download?version=signed`. Receiver boundary/duplicate/retry tests pass. Two real `DOCUMENT_COMPLETED` deliveries timed out before reaching the host. Replaying the actual stored event locally with the correct secret returned 200 twice and produced one completion marker, sealed PDF and image. This verifies processing, not direct network delivery. | Re-fetch ownership and completed state; persist PDF/hash before applying business transitions. Never trust webhook body alone. |
| Can callbacks reach a local receiver? | **Registration succeeds; direct delivery FAILED in this environment (10-second connection timeouts).** A literal private IP was rejected by registration even with the runtime allow-list. The local override now maps `spike-callback.test` to the host bridge and allows that exact hostname. The team webhook was persisted/enabled, but container→host requests still timed out, including a separate connectivity probe. Private destinations are rejected unless the one local callback host is allowed by `NEXT_PRIVATE_WEBHOOK_SSRF_BYPASS_HOSTS`. The opt-in spike override permits the Docker host bridge only. [Pinned URL check](https://github.com/documenso/documenso/blob/v2.20.0/packages/lib/server-only/webhooks/assert-webhook-url.ts). | Resolve local bridge/firewall reachability and repeat genuine delivery before US-044. No public tunnel, firewall change or Documenso patch was introduced. |
| Can the signature image be read back? | **Yes via the real local DB; public API omitted the image.** Public get-envelope/get-field schemas omit the signature relation. `getEnvelopeFieldSignatures` exists only as internal session tRPC. The receiver requests the public field first, then uses an optional parameterized read-only query joining `Signature`, `Field`, `Recipient` and `Envelope` scoped to this completed run. Actual-event replay saved a readable 920 × 400 PNG via `database-read-only`; missing-image/failure boundaries also pass with mocks. | Plan for version-sensitive DB access unless a supported public endpoint is established. Keep image and hash tied to the sealed departure evidence. A typed/missing image or failed DB query must be reported as unavailable, not fabricated. |
| Does the sealed PDF have an intact PAdES seal and detect changes? | **« to confirm by hand »** in Adobe Reader, including a separately modified copy and untrusted self-signed identity. The downloaded result was 1,266,470 bytes / 11 pages (10 contract + audit page), with a `ByteRange` and `ETSI.CAdES.detached` SubFilter. These structural observations do not replace seal verification. | Legal sufficiency (L-01/US-092) remains external; retain the sealed departure original as proof. |
| Is desktop embedding or a new tab preferable? | **New tab opened; plain iframe remained empty in the scripted Chromium harness.** Top-level signing completed. Human cross-browser usability remains **« to confirm by hand »**; iframe operation is not established. | Settle desktop behaviour before designing US-044. The iPhone web view/cleanup/sharing/phone timings belong to part 2. |

## Reproduction and retained evidence

Follow the [runbook](../../spikes/documenso/README.md) in order: render FR/EN;
start the local stack and check certificate; create team/token in the UI; set
external secret-file paths; configure callback; run `mail-check -- --baseline`;
`create -- --lang fr`; `mail-check`; `replace -- --lang en`; `mail-check`;
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
the mocks. Generated artifacts remain ignored. Replay output hashes:

- Sealed PDF SHA-256: `379e5321955365af3e8484ed502bec999b945f59cdd67ceef52c3b5ad2acdbb8`.
- Signature PNG SHA-256: `b26a2e011336798a3217777491be0ab4be8a06cba8f96677e3c184ded8f35d4a`.

The direct callback failed before application processing. Local replay of the
actual event succeeded twice; no duplicate download/artifact set was created.
A future run must record actual HTTP success in Documenso's webhook-call list,
not infer delivery from local replay. The plain iframe returned no visible
content within the harness observation; its cause was not established.

## Remaining gates

- Direct Documenso→host completion delivery failed with two 10-second timeouts.
  The authentic event replay downloaded the sealed PDF and image, but does not
  close this networking gate. Repeat on a local bridge with permitted connectivity.
- One human drawing, per-field/page taps, tab/iframe behaviour and Adobe Reader:
  **« to confirm by hand »**.
- The full story's 30-photo/amendment stress case, homelab and iPhone tests are
  outside ticket #5's server/browser tooling slice and remain incomplete.
- A material failure requires a developer/client decision before US-044; this
  experiment does not revise ADR-0020 or silently choose DocuSeal/per-page taps.
