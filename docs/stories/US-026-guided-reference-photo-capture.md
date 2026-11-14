# US-026 · Guided reference photo capture

| Epic | Priority | Phase | Size | Status |
|---|---|---|---|---|
| E2 · Home and vehicles | Must | P1 | M | To do |

- **Depends on:** [US-003](US-003-expo-app-skeleton.md) · [US-006](US-006-core-database-schema-and-storage.md)
- **Decisions:** [ADR-0024](../adr/0024-vehicle-condition-four-angles-estimates.md) · [ADR-0013](../adr/0013-personal-device-data-protection.md) · [ADR-0014](../adr/0014-file-storage.md) · [ADR-0005](../adr/0005-online-only.md)
- **Open points:** — (see [open questions](../discovery/open-questions.md))

## Story

As a staff member, I want the app to guide me through the standard photo angles, so that every reference set is complete and comparable.

## Acceptance criteria

- [ ] The capture screen walks through the 4 required angles, with a hint for each: front, rear, left side, right side (F-23). Then it offers the optional ones: front-left, rear-left, rear-right, front-right and interior (F-10). The list is configurable in code.
- [ ] There is no dashboard photo in the set, because it would show an old odometer reading at every later Départ.
- [ ] Reference photos come from the in-app camera only (`RECOMMENDED`), so each set is consistent and dated. On the web, the in-app camera is an in-page camera view that uses the rear camera: a set is taken on a phone or a tablet, and a computer without a suitable camera shows a message saying so ([ADR-0025](../adr/0025-web-app-first.md)).
- [ ] Each photo can be retaken before saving. The set is saved only when the 4 required angles have a photo; optional ones can be skipped.
- [ ] Photos are resized (1600 px on the long edge, JPEG about 0.7) and stripped of location metadata, in the app or the browser, then uploaded through the upload flow of [ADR-0014](../adr/0014-file-storage.md): to the temporary area, where the API checks each one.
- [ ] Uploads retry automatically while the app is open ([ADR-0005](../adr/0005-online-only.md)).
- [ ] Once every upload is verified, the API files the photos in `condition-photos`, and one SQL function creates the set and its photo rows (angle, size, SHA-256, author, time). They can't be changed afterwards.
- [ ] A new set replaces the previous one as current. The old set stays in the history and is never deleted.

## Notes

- Used when adding a vehicle (US-022), after a damage repair (US-082), and optionally after routine maintenance (US-081).
