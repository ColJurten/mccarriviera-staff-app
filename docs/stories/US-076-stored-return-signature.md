# US-076 · Record the client's signature at the drop-off and apply it to the finished Retour

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E7 · Retour | Must | P4 | M | To do |

- **Depends on:** [US-044](US-044-client-signs-in-the-app.md) · [US-070](US-070-start-a-retour.md) · [US-074](US-074-client-signs-the-retour.md) · [US-007](US-007-audit-trail-and-immutability.md)
- **Decisions:** [ADR-0023](../adr/0023-signatures-in-the-app-sealed-by-the-api.md) · [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md) · [ADR-0010](../adr/0010-contract-pdf-generation.md) · [ADR-0011](../adr/0011-localisation.md)
- **Open points:** L-01, L-03, L-07 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, when a client returning a car can't wait for the inspection to be finished, I want them to sign an authorisation and record their signature, so that I can finish the Retour after they leave and sign it with that signature.

## Acceptance criteria

- [ ] **Switch:** the feature exists only when `signature.storedReturnSignature` is `true` in the company configuration (F-28). It is `false` by default and `true` for MC Car Riviera. When it is off, the app doesn't show it and the API refuses its routes.
- [ ] **Offer:** on a Retour in progress, with no signature yet, « Client pressé : enregistrer sa signature » is offered.
- [ ] **Authorisation:** the app shows the authorisation text in the contract's language, from the current version (stored in `terms_versions` with kind `return_authorisation`, [ADR-0011](../adr/0011-localisation.md)). It names the client, the contract, the vehicle and the time, and the km and fuel if staff have entered them. An English text is required for an English contract (R-17).
- [ ] **Capture:** the client draws once on the pad and confirms. The API renders the authorisation page, stamps the drawing, seals it ([US-043](US-043-pdf-sealing-and-signature-certificate.md)) and stores it. It creates a `stored_signatures` record, status `pending`, with the drawing and its stroke points and SHA-256, the capture time, the staff user, the device, the km and fuel at capture, and the text version.
- [ ] Only one `pending` record per Retour; a second capture is refused.
- [ ] **Waiting:** the Retour shows « Signature enregistrée — à finaliser » in the Contrats tab and on Home. There is no time limit (F-28).
- [ ] **Use:** once the inspection and the final statement are complete, the preview screen offers « Apposer la signature enregistrée ». Staff see the preview first. The API then:
  - stamps the stored drawing into the « Signature retour » boxes, with « Enregistrée le … · apposée le … »;
  - adds the authorisation page before the general terms;
  - records the stored mode, the capture time and the application time on the signature certificate page;
  - seals and stores the final PDF, and closes the Retour in one transaction ([US-074](US-074-client-signs-the-retour.md));
  - sets the record to `applied`, with the time and the staff user.
- [ ] **Single use:** the API refuses to apply the record to any other contract, stage or document, or a second time. Status changes go only through SQL functions.
- [ ] **Cancel:** if the client comes back and signs in person, or the contract is voided, the record becomes `cancelled` with a reason. It can't be used any more; the drawing stays as evidence (L-03, L-07).
- [ ] **After:** the final PDF is archived and shared from the app as today ([US-042](US-042-archive-and-share-pdfs.md)). Nothing is e-mailed automatically (F-28).
- [ ] Database and API tests cover: switch off (refused); capture then application; a second capture (refused); application to another contract (refused); a second application (refused); cancellation after an in-person signature; a Retour changed after the capture ([US-058](US-058-change-a-contract-awaiting-signature.md)).

## Notes

- From the client meeting of November 2026 (F-28): the client has no time to review the Retour, and the draft isn't ready to sign.
- **Dispute risk:** the client doesn't see the new damage or the final amounts when signing. That is why it can be switched off, needs an authorisation, and is limited to one Retour. The lawyer reviews the practice and the authorisation text before go-live (L-01). The draft wording is in the contract template ([`i18n/fr.json`](../contract-template/i18n/fr.json), key `authorisation.intro`).
