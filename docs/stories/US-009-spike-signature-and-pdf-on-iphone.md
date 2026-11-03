# US-009 · Spike: prove Documenso signing and server-rendered PDFs on a real iPhone

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E0 · Foundations | Must | P0 | M | To do |

- **Depends on:** [US-005](US-005-eas-builds-and-internal-distribution.md)
- **Decisions:** [ADR-0020](../adr/0020-signatures-with-documenso.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0002](../adr/0002-mobile-stack-expo.md) · [ADR-0018](../adr/0018-development-and-test-devices.md)
- **Open points:** F-16, L-01 (see [open questions](../discovery/open-questions.md))

## Story

As the developer, I want to try the riskiest technical parts on a real iPhone before building features, so that the signing and PDF choices are proven early.

## Acceptance criteria

- [ ] A throwaway Documenso (pinned version, Community Edition) runs on the homelab VM, with a self-signed .p12 certificate and public sign-up disabled.
- [ ] A test PDF is rendered with Chromium (Playwright) from the template v1 prototype, with synthetic data: a contract page, 30 photo thumbnails continuing over several pages, full-size photo pages, terms over several pages and 5 amendment pages. Every page repeats the header, the footer and the signature box at the same position, in French and in English (B-07).
- [ ] The PDF is sent to Documenso through its API (v2), with a signature field in the « Signature départ » box of every page, and its signing page opens in a react-native-webview on the test iPhone.
- [ ] **One drawing fills every signature field** (F-17). If Documenso asks for a tap on each field, this is measured, and the options are taken to the client before US-044.
- [ ] Documenso's e-mails to the signer can be switched off for the document, and the signer can be a placeholder address on a subdomain with no mail server (F-16). How is recorded.
- [ ] The webhook `DOCUMENT_COMPLETED` reaches a test endpoint and is checked with its secret. The sealed PDF downloads, and opens in Files, Mail and WhatsApp. Adobe Reader shows the seal (signer identity unverified, with a self-signed certificate) and detects a modified copy.
- [ ] The image of the client's signature can be read back, through Documenso's API or its database, for the final PDF (F-17).
- [ ] Replacing a waiting envelope works (deleting it and creating a new one), for the language switch in the preview.
- [ ] The web view keeps no cookies, cache or local storage once closed.
- [ ] Timings are recorded: rendering a 10-photo contract on the server, creating the envelope, and opening the signing page on the phone over mobile data. The 30-photo case is measured.
- [ ] Whether Documenso's embedding script or its plain signing page works better in the web view is recorded.
- [ ] Findings are recorded. If something doesn't work, ADR-0020 is changed before any feature builds on it. DocuSeal is the fallback to try.

## Notes

- This is throwaway code. Only what is learned is kept.
- It doesn't wait for US-004: the throwaway Documenso and a small test endpoint run on the homelab.
