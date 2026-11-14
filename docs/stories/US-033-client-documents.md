# US-033 · Attach and view client documents

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E3 · Clients | Must | P1 | M | To do |

- **Depends on:** [US-031](US-031-create-a-client.md)
- **Decisions:** [ADR-0014](../adr/0014-file-storage.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** R-15, L-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to photograph or upload the client's licence, ID and other files, so that the company keeps the documents it needs with the client record.

## Acceptance criteria

- [ ] From the client record, « Ajouter un document » offers: take a photo (in-app camera), choose from the photo library, or choose a file (PDF or image).
- [ ] Each document has a type (permis, carte d'identité, passeport, autre) and an optional label.
- [ ] Accepted files: PDF, JPEG and PNG, up to 10 MB. Images are resized and stripped of location metadata, and other image formats are converted to JPEG before upload. Files reach the private `client-documents` bucket through the upload flow of [ADR-0014](../adr/0014-file-storage.md): a temporary upload, checked by the API, then filed.
- [ ] Documents are listed with type and date. Opening one uses a presigned link valid for 5 minutes or less, in an in-app viewer. Nothing is saved on the device.
- [ ] A document uploaded by mistake can be deleted after confirmation (default for R-15). The deletion is audited, without its content.
- [ ] No document is required before a Départ (default for R-15).

## Notes

- How long documents are kept is a legal question (L-03), applied by US-094.
