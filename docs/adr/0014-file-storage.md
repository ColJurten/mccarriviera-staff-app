# ADR-0014: File storage: private S3 buckets, upload-only evidence, short-lived presigned links

| Status | Date | Decided by | Based on |
|---|---|---|---|
| **Accepted** | 2026-10-07 (updated 2026-11-14) | Developer, with the client's answers | Brief · B-04, B-09 · F-11, F-31, F-32 (answered) · defaults for R-15, L-03, L-07 |

## Context

- Photos, client documents, signatures and PDFs are personal data.
- Signatures, photos and PDFs are also evidence.
- The brief says: "Do not assume documents should be publicly accessible via simple URLs".
- **F-11** (2026-11-03): the files live in S3 storage, behind the developer's own API ([ADR-0019](0019-backend-own-api-postgres-s3.md)).

## Decision

- **Where:** Scaleway Object Storage, Paris region, in the developer's account (F-11, F-14).
- **Private buckets only**, one set per environment (for example `mcr-prod-contract-pdfs`):
  - `condition-photos`: reference sets, dashboard photos, damage photos;
  - `client-documents`;
  - `vehicle-documents`: the registration, the insurance and other files of a vehicle (F-32);
  - `signatures`: the client's drawings and their stroke points, including stored Retour signatures ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md));
  - `contract-pdfs`: sealed PDFs and other generated PDFs;
  - `incoming`: the temporary area where the app uploads. Nothing stays there (F-31).
- **Object keys use IDs, never names:**
  - `vehicles/{vehicle_id}/baselines/{baseline_id}/{photo_id}.jpg`
  - `damages/{damage_id}/{photo_id}.jpg`
  - `inspections/{inspection_id}/{photo_id}.jpg`
  - `clients/{client_id}/{document_id}.{ext}`
  - `vehicles/{vehicle_id}/documents/{document_id}.{ext}`
  - `contracts/{contract_id}/signatures/{signature_id}.png` for the drawing, and the same key ending in `.json` for its stroke points
  - `contracts/{contract_id}/pdfs/{revision}-{stage}-{lang}-{timestamp}.pdf`, where the stage is `preview`, `departure`, `final` or `authorisation`. Previews are kept, so the API stamps exactly the file the client saw ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).
  - in `incoming`: `{upload_id}`

  The file name staff see when sharing is in [US-042](../stories/US-042-archive-and-share-pdfs.md).
- **Access:**
  - The app never holds storage keys. Every upload and download goes through a **presigned link** that the API issues after checking the session, the kind of file and its size. Links expire within **5 minutes**. Nothing is public.
  - **Upload** (F-31), for photos and documents:
    1. the app asks the API for an upload link, giving the kind of file, its type and its size. The API records an `uploads` row and returns a link to a new key in `incoming`;
    2. the app sends the file, then confirms. The API reads the stored object, checks its size and its real type, computes its SHA-256 and marks the upload as verified;
    3. the route that creates the record (a reference set, a damage, a dashboard photo, a document) names its verified uploads. The API copies each file to its final key, creates the rows in one transaction, and removes the temporary copy. An upload is used once.
  - **The app never writes to the other buckets:** only the API does. No link ever points at a filed object, so none can replace it.
  - **Signatures and PDFs** have no upload link. The drawing and its stroke points arrive in the signing request, and the API writes them, the previews and the sealed PDFs itself ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)).
  - **Allowed types** (`RECOMMENDED`): JPEG for condition photos; PDF, JPEG and PNG for client and vehicle documents. The app converts other image formats to JPEG before upload.
  - **Unused uploads:** an upload that is never filed expires after 24 hours, and a lifecycle rule empties `incoming` (`RECOMMENDED`).
  - **Download:** the app asks the API for a link to a file it is allowed to see.
  - **Evidence buckets** (`condition-photos`, `signatures`, `contract-pdfs`): the API's storage key can write and read, but bucket policies give it no delete permission. Keys are never reused, so nothing is overwritten. Versioning is on, so an overwrite by mistake would keep the original (`RECOMMENDED`).
  - `client-documents` and `vehicle-documents`: the API can also delete, for a document uploaded by mistake (default for R-15). It can delete in `incoming` too.
  - The backup job has its own read-only key ([ADR-0015](0015-backups.md)). The developer's administrator key is kept outside the servers.
- **Size:**
  - photos are resized on the device, in the app or the browser, to 1600 px on the long edge, JPEG quality about 0.7 (roughly 200–400 KB each);
  - document files are limited to 10 MB;
  - PDF photo thumbnails are made by the API at render time ([ADR-0010](0010-contract-pdf-generation.md)).
- **Metadata:** every file has a database row recording what it belongs to, its kind, size, SHA-256, who uploaded it, when, and whether it came from the photo library (« importée »).
- **Retention:**
  - The app deletes nothing, except client and vehicle documents uploaded by mistake, and temporary uploads.
  - Every generated PDF is archived, since the brief lists generated PDFs among the back end's data.
  - Deletion and anonymisation follow the retention procedure ([US-094](../stories/US-094-retention-and-erasure.md)). Until L-03 and L-07 are answered, nothing is deleted (default for L-03 and L-07).

## Consequences

**Positive**

- No file is reachable without a valid session.
- Evidence can't be overwritten or deleted from the app, nor with the API's own key.
- Storage costs cents a month at this size.

**Negative / risks**

- Presigned links expire, so the viewer must ask for new ones.
- The API, not the storage service, decides who gets a link. Its checks are tested ([ADR-0012](0012-authentication-and-authorisation.md)).
- A file uploaded by mistake to an evidence bucket stays there. Only the developer can remove it, through the retention procedure.
- Each file is copied once inside the storage service, and an upload abandoned half-way leaves a row and a temporary file until they expire.

## Alternatives considered

| Option | Why not chosen |
|---|---|
| Supabase Storage | Left with Supabase (ADR-0019) |
| Files inside Postgres | Bloats the database and its backups |
| Public buckets with unguessable names | Still public links |
| Uploads through the API instead of presigned links | Simpler checks, but every photo would pass through the server twice. The API still checks the result |
| Upload links that point straight at the final key | A link could be replayed for 5 minutes and replace the file, so every later use would need a hash check (F-31) |
| No table for uploads | Uploads that are never used would not be tracked (F-31) |

## Revisit when

The volume grows enough for storage costs to matter, or the provider changes.

## Changes

- 2026-10-09: F-11 opened: the files could move to an S3-compatible bucket.
- 2026-11-03: F-11 answered (option C): the files live in Scaleway Object Storage, behind the developer's API, with presigned links. Documenso's files get their own bucket.
- 2026-11-10: Documenso is removed ([ADR-0023](0023-signatures-in-the-app-sealed-by-the-api.md)): no Documenso bucket. `signatures` holds the drawings captured in the app; previews and the authorisation page of a stored signature are kept as PDFs.
- 2026-11-14: F-31 answered: uploads go to a temporary bucket with an `uploads` table, and the API files them; allowed file types listed; stroke points get their own key. F-32 answered: a `vehicle-documents` bucket. « Extra departure photos » left the bucket list (F-23).

## Implemented by

- [US-006](../stories/US-006-core-database-schema-and-storage.md): Create the core database schema, access rules and storage
- [US-013](../stories/US-013-minimum-local-data-on-phones.md): Keep client data on staff phones to a minimum
- [US-016](../stories/US-016-client-data-in-the-browser.md): Keep client data out of the browser on laptops, phones and the agency computer
- [US-022](../stories/US-022-add-a-vehicle.md): Add a vehicle with its reference photos
- [US-026](../stories/US-026-guided-reference-photo-capture.md): Guided reference photo capture
- [US-027](../stories/US-027-vehicle-documents.md): Attach and view vehicle documents
- [US-033](../stories/US-033-client-documents.md): Attach and view client documents
- [US-042](../stories/US-042-archive-and-share-pdfs.md): Archive, download and share contract PDFs
- [US-044](../stories/US-044-client-signs-in-the-app.md): Preview a contract PDF and have the client sign it in the app
- [US-053](../stories/US-053-confirm-departure-condition.md): Confirm the departure condition
- [US-072](../stories/US-072-return-inspection.md): Inspect the vehicle: new damage or RAS
- [US-094](../stories/US-094-retention-and-erasure.md): Apply retention and erasure rules
