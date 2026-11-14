# US-027 · Attach and view vehicle documents

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E2 · Home and vehicles | Must | P1 | S | To do |

- **Depends on:** [US-022](US-022-add-a-vehicle.md) · [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0014](../adr/0014-file-storage.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md)
- **Open points:** L-03 (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want to attach the registration certificate, the insurance and other files to a vehicle, so that the car's papers are at hand with its record.

## Acceptance criteria

- [ ] From « Nouveau véhicule » and from the vehicle's detail screen, « Pièces jointes » offers: take a photo, choose from the photo library, or choose a file.
- [ ] Each document has a type (carte grise, assurance, contrôle technique, autre; `RECOMMENDED`) and an optional label.
- [ ] Accepted files: PDF, JPEG and PNG, up to 10 MB. Images are resized and stripped of location metadata, and other image formats are converted to JPEG before upload ([ADR-0014](../adr/0014-file-storage.md)).
- [ ] Files reach the private `vehicle-documents` bucket through the upload flow of ADR-0014: a temporary upload, checked by the API, then filed.
- [ ] Documents are listed with their type, label and date. Opening one uses a presigned link valid for 5 minutes or less, and nothing is kept on the device.
- [ ] A document attached by mistake can be deleted after confirmation, as for client documents (default for R-15). The deletion is audited, without its content.
- [ ] No vehicle document is required before a Départ, and none is printed on the contract.
- [ ] Database and API tests cover: attach, list, open and delete; a refused file type; a file over 10 MB.

## Notes

- From the review of 2026-11-14 (F-32): the design's « Nouveau véhicule » screen has « Pièces jointes · PDF, JPG… », and the developer confirmed vehicle documents for the MVP.
- New table `vehicle_documents`, modelled on `client_documents` ([US-006](US-006-core-database-schema-and-storage.md)).
