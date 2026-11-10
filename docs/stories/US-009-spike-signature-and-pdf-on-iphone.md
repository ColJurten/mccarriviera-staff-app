# US-009 · Spike: prove in-app signing, stamping and sealing, and server-rendered PDFs, in a browser and on a real iPhone

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | M | In progress |

- **Depends on:** —
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0021](../adr/0021-web-app.md) · [ADR-0002](../adr/0002-mobile-stack-expo.md) · [ADR-0018](../adr/0018-development-and-test-devices.md)
- **Open points:** L-01 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want to try the riskiest technical parts on a real iPhone before building features, so that the signing and PDF choices are proven early.

## Part 1: Documenso (done, 2026-11-05)

Ticket #5, PR #21, Documenso v2.20.0. Rendering, envelopes, the language switch, the webhook, e-mails switched off and reading the signature back all worked. **One drawing did not fill the fields: 10 taps for 10 pages**, and Documenso's code doesn't fill signature fields by itself. The developer confirmed it by hand on 2026-11-10. Signing moved to the app ([ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md)), so Documenso isn't used any more.

## Part 2: signing in the app, stamping and sealing on the API

### Acceptance criteria

- [ ] A test PDF is rendered with Chromium (Playwright) from the template v2 prototype, with synthetic data: page 1 with every field at its maximum length, 30 photo thumbnails continuing over several pages, 10 damage records with estimates, full-size photo pages and terms over several pages. Every page repeats the header, the footer and the signature box at the same position, in French and in English (B-07). The template gives the box positions as data.
- [ ] A throwaway script stamps one drawing into the « Signature départ » box of every page of that PDF, without rendering it again, then appends a signature certificate page.
- [ ] Two sealing libraries are tried on the stamped file: pyHanko (called as a command) and a maintained Node library. Each applies a PAdES signature with a self-signed .p12 certificate and an RFC 3161 timestamp. The choice, and the timestamping authority, are recorded.
- [ ] The sealed PDF opens in Files, Mail and WhatsApp. Adobe Reader shows the seal (signer identity unverified, with a self-signed certificate) and the timestamp, and detects a modified copy.
- [ ] **One drawing, every page, at once** (F-17): the client draws once and every box is filled, with no tap per page.
- [ ] In a desktop browser, a canvas pad works with a mouse and a touch screen ([ADR-0021](../adr/0021-web-app.md)). At the start of the front end, the pad component chosen for the app works on the test iPhone in portrait and landscape (needs [US-005](US-005-eas-builds-and-internal-distribution.md)), and its PNG and stroke points reach a test endpoint.
- [ ] Timings are recorded: rendering a 10-photo contract, stamping and sealing it, and the round trip from the phone over mobile data. The 30-photo case is measured, with the server's memory use (it sets the server size, [ADR-0019](../adr/0019-backend-own-api-postgres-s3.md)).
- [ ] Findings are recorded in `docs/spikes/US-009-findings.md`. If something doesn't work, ADR-0023 is changed before any feature builds on it.

## Notes

- This is throwaway code. Only what is learned is kept.
- Run part 2 in two halves. The server and browser checks come first, with the back end (build order, 2026-11-03), since their answers shape US-043 and US-044. The iPhone pad check comes at the start of the front end.
