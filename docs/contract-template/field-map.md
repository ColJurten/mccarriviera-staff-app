# Contract template v2: field map

Every field of the new contract PDF: where it sits, its label in each language, which template it comes from, when it is filled, and where the value is stored.

- **Decision (2026-11-02, R-02):** the new template is the model template plus every field of the current form. All of the model's fields are kept.
- **Layout:** the model's presentation, as label/value tables, the logo at the top right, a contact footer and a signature on every page. The signature block sits at the bottom right of every page (F-08).
- **Version 2 (2026-11-10, client meeting):** page 1 holds the contract and the pricing; « Services inclus », the key-terms box and the amendment pages are dropped (F-22); four required reference angles and no loose extra photos (F-23); new damage first with estimates, damage already present in an annex (F-24); damage found at the Départ (F-25); stored Retour signature (F-28).
- **Specimens:** [`samples/`](samples/). How to rebuild them: [`README.md`](README.md).

**Source:** C = current form (`current_template.pdf`) · M = model template (`model_template.pdf`) · C + M = on both, merged into one field · Decision = required by a decision, not printed on either form.
**When:** D = Départ · R = Retour · A = amendment (recorded in the app, not printed) · S = settings or fixed text · C = computed by the app.
**Stored in:** physical tables from US-006. Snapshot field groups are mapped below. **New** marks fields added to the original working model.

## Every page

| Element | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Logo, top right | — | — | C + M | S | company config | Placeholder until the brand assets arrive (R-18) |
| Document title | Contrat / facture location | Rental contract / invoice | C | S | i18n | Title kept, as decided in B-04 (L-04) |
| Page title | Contrat de location, État du véhicule… | Rental agreement, Vehicle inspection… | M | S | i18n | |
| Contract number | N° de contrat | Contract no. | M (Reservation no.) | D | `contracts.number` | `MCR-YYYY-NNNN` (R-09), reserved when the preview to sign is created, since the sealed PDF carries it (F-18) |
| PDF stage | PDF du départ / PDF final | Pick-up PDF / Final PDF | Decision | — | `contract_documents.stage` | ADR-0010 |
| Signature block, bottom right | Signature départ · Signature retour | Pick-up signature · Drop-off signature | C (S1–S4) + M (one per page) | D, R | `signatures` | The API stamps the client's one drawing in these boxes on every page (ADR-0023); the final PDF repeats the departure drawing (F-17). Same position in FR and EN |
| Signature date and time | Signé le … · with a stored signature: Enregistrée le … · apposée le … | Signed on … · Recorded … · applied … | Decision | D, R | `signatures.signed_at`, `stored_signatures.captured_at`, `applied_at` **New** | Server times. The signature certificate page the API appends gives the full evidence (ADR-0023) |
| Footer: company identity | Name, address, SIRET, APE, phones, website | same | C (header) + M (footer) | S | [`config/company.json`](config/company.json) | Copied from the current form, to be confirmed by the client; e-mail unknown |
| Footer: page, edition date, template and terms versions | Page n / N · Édité le … · modèle v2 · CGV FR v1 | Page n of N · Issued on … · template v2 · terms EN … | Decision | — | `contract_documents` | ADR-0010. The terms version is the one printed in that PDF's language. « Page n / N » doesn't count the signature certificate page |

## Page 1: Contrat de location (the model's page 1 and the current form's pricing)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Pick-up place | Lieu de départ | Pick-up location | M | D | `contract_revisions.pickup_place` **New** | Free text (R-05) |
| Departure date and time | Date & heure de départ | Pick-up date & time | C + M | D | `contract_revisions.departure_at` | |
| Return place | Lieu de retour | Drop-off location | C + M | D, A | `contract_revisions.return_place` | |
| Planned return | Retour prévu | Planned return | C + M (Drop off date) | D, A | `contract_revisions.planned_return` | Page 1 keeps the value signed at the Départ; a later change is recorded in the app and billed in the final statement (F-22) |
| Number of days | Nombre de jours | Number of days | M | D, A | `contract_revisions.rental_days` **New** | Typed by staff (F-06) |
| Flight or train | Vol / train | Flight / train | M | D | `contract_revisions.flight_train` **New** | Optional |
| Intermediary, phone | Intermédiaire · Tél. | Intermediary · Phone | C | D | `contract_revisions.intermediary`, `contract_revisions.intermediary_phone` | R-08 |
| Title, first name, last name | Locataire: Civilité · Prénom · Nom | Renter: Title · First name · Last name | M (C has one name line) | D | `clients.title`, `clients.first_name`, `clients.last_name` **New** | Replace `clients.full_name` |
| Date of birth | Date de naissance | Date of birth | C + M | D | `clients.birth_date` | |
| Place of birth | Lieu de naissance | Place of birth | C (country after the date) + M (POB) | D | `clients.birth_place_or_country` | Meaning still open (R-03 Q3) |
| E-mail | E-mail | Email | M | D | `clients.email` **New** | Optional |
| Phone | Téléphone | Phone | C (Tél.) + M (Mobile no.) | D | `clients.phone` | |
| Billing address | Adresse de facturation | Billing address | C + M (Street & house no.) | D | `clients.street`, `clients.line2` | |
| City, postcode | Ville · Code postal | City · Postcode | C + M | D | `clients.city`, `clients.postcode` | |
| Country | Pays | Country | M (R-03 default) | D | `clients.country` | |
| State or region | État / région | State / region | M | D | `clients.state_region` **New** | Optional, for foreign addresses |
| Local address and phone | Adresse locale · Tél. adresse locale | Local address · Local phone | C | D | `clients.local_address`, `clients.local_phone` | Per client or per rental: R-03 Q4 |
| ID document: type, number, country | Pièce d'identité: Passeport / Carte d'identité · N° · Pays | ID document: Passport / ID card · No. · Country | C + M (Passport/ID no.) | D | `clients.id_doc_type`, `id_doc_number`, `id_doc_country` | Country meaning open (R-03 Q3) |
| ID document dates | Délivrance / expiration | Issued / expires | M | D | `clients.id_doc_issued_on`, `clients.id_doc_expires_on` **New** | Optional. Printed as 01/09/2006 in French, to fit page 1 |
| Driving licence number | Permis de conduire n° | Driving licence no. | C + M | D | `clients.licence_number` | |
| Licence dates | Délivrance / expiration | Issued / expires | M | D | `clients.licence_issued_on`, `clients.licence_expires_on` **New** | The issue date makes the « permis de plus d'un an » rule of the terms (Art. 1) checkable; the app only records it (R-04) |
| Additional information | Informations complémentaires | Additional information | M | D | `contract_revisions.additional_info` **New** | `INTERPRETATION`: per rental, not per client, so it never goes stale |
| Additional driver | 2e conducteur: Nom et prénom · Date de naissance · Permis n° | Second driver: Full name · Date of birth · Licence no. | C (name, date of birth, licence) + M (name) | D, A | `contract_drivers` → `clients` | One additional driver (R-03) |
| Make and model | Marque & modèle | Make & model | C + M | D | snapshot of `vehicles.make_model` | |
| Licence plate | Immatriculation | Licence plate | C + M | D | snapshot of `vehicles.plate` | |
| Colour | Couleur | Colour | C | D | snapshot of `vehicles.colour` | |
| Fuel type | Carburant | Fuel type | C + M | D | snapshot of `vehicles.fuel_type` | |
| Pick-up agent | Agent au départ | Pick-up agent | M (Pick-up driver) | D | `staff_profiles.display_name` **New**, snapshot at signature | R-19 Q1 answered: the staff name is printed. Shown in the additional-driver block |
| Daily rates | Tarif / jour 1 à 3 j · 4 à 7 j | Daily rate 1–3 days · 4–7 days | C | D | `contract_revisions.rate_rate_1_3`, `rate_4_7` | |
| Extra day (row 2) and km included | Jours sup. · Km inclus | Extra day · Km included | C | D | `contract_revisions.rate_extra_day_1`, `km_included` | « Kms inclus » also appears on page 3, same value |
| Package | Forfait … pour … jours | Package … for … days | C | D | `contract_revisions.rate_package_price`, `package_days` | |
| Extra day (row 4) and extra km | Jours sup. · Km sup. | Extra day · Extra km | C | D | `contract_revisions.rate_extra_day_2` **New**, `extra_km` | The form has two « Jours sup » rows; both are kept as typed fields (B-05) |
| Deductible card | Franchise et dépôt de garantie: Carte VISA / AMEX / AUTRE | Deductible and security deposit: Card | C | D | `contract_revisions.card_brand` | R-07 Q3 |
| Deductible amounts | Vol · Accident responsable | Excess theft · Excess at-fault accident | C | D | `contract_revisions.deductible_theft`, `deductible_accident` | The app warns when billed damage exceeds the at-fault accident amount (F-24) |
| Security deposit | Dépôt de garantie | Security deposit | M (Deposit), and CGV Art. 7 « fixé au recto » | D | `contract_revisions.deposit` **New** | Moved here from the dropped services box (F-22). Amount only; the deposit itself is taken outside the app (B-10). How it relates to « Total prépayé » is still R-07 Q1 |
| Payment method | ESP · CC | Cash · Card | C | D | `contract_revisions.payment_method` | |
| Card imprint | Empreinte carte de crédit, type de carte | Credit card imprint, card type | C | D | `contract_revisions.card_brand`, `contract_revisions.card_last4` | Brand and last four digits only (F-09) |
| Card expiry | Date de validité | Expiry date | C | D | `contract_revisions.card_expiry` | MM/YY (F-09) |
| CVV | CVV | CVV | C | — | none | Printed, always empty (F-09) |
| Charges at the Départ | Tarification, column « Au départ »: Location, J / sup, Km sup, Total H.T. location, Assurance −25 ans, Conducteur sup., Livraison, Option I–III, Carburant, Divers, Dommages, Total H.T., TVA 20 %, Total TTC, Total prépayé, Solde | Charges, column "At pick-up" | C | D | revision snapshot `contract_revisions.pricing_*` | Typed by staff (F-06) |
| Final statement | Column « Décompte final », same lines | Column "Final statement" | C (filled at the Retour on paper) | R | `inspections.final_pricing_*` (return) | Typed by staff (F-06), except « Dommages ». Empty in the Départ PDF. Reflects changes agreed during the rental, such as an extension (F-22) |
| Damage line | Dommages (estimations facturées) | Damage (billed estimates) | Decision (F-24) | R | `inspections.final_pricing_damage` **New** | Sum of the estimates marked « facturée », filled by the app. Its VAT treatment is still L-04 |
| Declaration next to the signature | Déclaration: « Je déclare avoir lu et compris le présent contrat… » | Declaration | M | S | i18n | New wording adapted from the model; to validate (L-02) |
| Acceptance text | Acceptation: « J'ai lu et accepté les conditions stipulées ci-contre et au verso… » | Acceptance | C | S | i18n | Verbatim from the current form, next to the declaration since the pricing moved to page 1. « ci-contre et au verso » no longer matches the layout, and the English version is a draft: both go to the lawyer (L-02, R-17) |

## Page 2: État du véhicule (the model's page 2)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Contract summary | Rappel du contrat: N° de contrat, Locataire, Permis n°, Date de naissance, Délivrance / expiration, Marque & modèle, Immatriculation | Contract summary | M | — | as page 1 | Repeated from page 1, as on the model |
| Date and time | Date & heure, Départ and Retour columns | Date & time | C | D, R | `inspections.at` | |
| Agent | Agent | Agent | M | D, R | staff display name, snapshot | R-19 |
| Km out | Kms départ | Kms out | C + M (Kilometers) | D | `inspections.km` (departure) | |
| Km in | Kms retour | Kms in | C | R | `inspections.km` (return) | |
| Km driven | Kms parcourus | Kms driven | C | C | computed | Km in − km out (R-06) |
| Km included | Kms inclus | Kms allowed | C | — | `contract_revisions.rate_km_included`, after any change during the rental | |
| Extra km billed | Kms facturés | Extra kms | C | C | computed | max(0, driven − included) (R-06) |
| Fuel | Jauge essence: eighths, with the percentage | Fuel gauge | C (eighths) + M (Tank reading %) | D, R | `inspections.fuel` | Stored in eighths (R-06); the percentage is computed (n × 12.5 %) |
| Car papers | Papiers du véhicule: Oui / Non | Car papers: Yes / No | M | D, R | `inspections.car_papers` **New** | CGV Art. 9 asks for the documents back |
| Clean inside | Propreté intérieure | Clean inside | M | D, R | `inspections.clean_inside` **New** | |
| Clean outside | Propreté extérieure | Clean outside | M | D, R | `inspections.clean_outside` **New** | |
| GPS | GPS / navigation | GPS / navigation | M | D, R | `inspections.gps` **New** | |
| Reference photos | Photos de référence, jeu du … | Reference photos, set of … | Brief, ADR-0024 (replaces the drawings of both forms) | D | `condition_baselines`, `photos` | Front, rear, left and right required; front-left, rear-left, rear-right, front-right and interior optional (F-23) |
| Dashboard photo | Tableau de bord | Dashboard | F-10 | D, R | `photos` (kind dashboard) | Optional |
| Damage present at the Départ | Dommages existants au départ | Damage already present at pick-up | C (Descriptif véhicule) + ADR-0024 | D | `damages` open at the Départ | On this page in the Départ PDF; in the final PDF, a one-line pointer to the annex (F-24) |
| Damage found at this Départ | tag « constaté à ce départ » | tag "found at this pick-up" | Decision (F-25) | D | `damages.found_stage`, `damages.found_contract_id` **New** | A damage record the client or staff spot at the Départ; listed with the damage already present, never charged to this renter |
| New damage or RAS | Retour · Nouveaux dommages / RAS — Rien à signaler | Drop-off · New damage / Nothing to report | C (Descriptif véhicule, retour) + brief | R | `damages` found at the Retour, `inspections.ras` | Shown first and full width in the final PDF (F-24). Photos with « importée » if picked from the library |
| Estimate | Estimation … € · indicative, coût définitif facturé après réparation / facturée au décompte final | Estimate … · indicative, final cost invoiced after repair / billed in the final statement | Decision (F-24) | R | `damages.estimate_amount`, `damages.estimate_mode` **New** | Optional, per new damage; staff choose the mode |
| Comment | Commentaire | Comment | C (the two blank lines of each box) | D, R | `inspections.comment` | |
| Declaration next to the signature | « Je déclare avoir inspecté le véhicule au départ et/ou au retour et en accepter l'état. » | "I declare that I have inspected the vehicle…" | M | S | i18n | Matches CGV Art. 3; to validate (L-02) |

## Annexe · Dommages déjà présents au départ (final PDF)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Introduction | « Dommages présents au départ de cette location… » | "Damage present at the start of this rental…" | Decision (F-24) | S | i18n | New wording; to validate (L-02) |
| Each damage | Photo, comment, « Constaté le … au départ / au retour du contrat … » | Photo, comment, "Found on … at the pick-up / drop-off of contract …" | ADR-0024 | D | `damages`, `photos` | Only damage open at the Départ; the full-size photos are in the photo annex |

## Autorisation de signature (final PDF, stored Retour signature only)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Authorisation text | « Je soussigné(e) …, locataire du contrat …, restitue le véhicule … sans assister à la fin de l'état des lieux de retour. J'autorise … » | "I, the undersigned …" | Decision (F-28) | S | `terms_versions` with `kind` = `return_authorisation` **New**, per language | Draft wording; the lawyer reviews it (L-01) |
| Recorded on, agent, place, km and fuel at the drop-off | Signature enregistrée le · Agent · Lieu · Kms au retour · Jauge au retour | Signature recorded on · Agent · Place · Kms in · Fuel at drop-off | Decision (F-28) | R | `stored_signatures` **New** | Km and fuel only if staff had entered them |
| Client's drawing | Signature du client | Client's signature | Decision (F-28) | R | `stored_signatures.image_path` **New** | The same drawing as in the Retour boxes |
| Applied on, by, to what | Apposée le · Par · Sur | Applied on · By · To | Decision (F-28) | R | `stored_signatures.applied_at`, `applied_by` **New** | |

## Further pages

| Pages | Content | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Conditions générales | The French terms, version v1, typed from the scan ([`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md)) | C (page 2, « au verso ») + M (page 3, signed) | S | `terms_versions.body_pages` | Stored already split into pages (US-041). Gaps in the scan are marked […]; the client's source file, then the lawyer's update (L-02), replace it. English: none yet (R-17) |
| Annexe photos | Every photo of the contract at full size, two per page, with stage, kind, angle, date and time | R-01 Q2 answered: thumbnails plus full-size pages | D, R | `photos` | Final PDF: new damage and the return dashboard first, then the reference set, the departure dashboard and the damage already present (F-24) |
| Signature certificate | Appended by the API after the numbered pages: signer, staff user, times, device, IP, signing mode, hashes | Decision (ADR-0023) | D, R | `signatures` | Not counted in « page n / N » |

## Not carried over

| Item | From | Why |
|---|---|---|
| The model's own texts: rules paragraph, liability and traffic-violation paragraphs, terms URL, Swiss terms and conditions | M | Another company's wording, written under Swiss law (source analysis §3.1). Replaced by MC Car Riviera's own terms and texts |
| Car outline with damage marks; the page of drawings | M (page 2), C (pages 1 and 3) | Photos only (brief) |
| Fuel as a percentage only | M | Kept in eighths, with the percentage alongside (R-06) |
| Handwritten invoice reference (« FACT 1336 ») | C | Replaced by the contract number; whether it also replaces the invoice number is R-09 Q4 |
| Services included, key-terms box | M | Dropped at the client's request (F-22, 2026-11-10) |
| Amendment pages, the revision number in the header | Template v1 | Dropped at the client's request (F-22, 2026-11-10). Amendments are recorded in the app; the final statement reflects them |
| Loose extra photos | Template v1 (B-09) | Photos at a handover belong to a damage, or are the dashboard photo (F-23) |

## Physical snapshot columns (US-006 part 1)

The client fields above describe the editable client file. Each revision copies
all of them to typed `contract_revisions.renter_*` and `additional_*` columns
(for example `renter_last_name`, `additional_licence_number`). PDFs use these
snapshots, never a later edit to `clients` or `contract_drivers`. Vehicle values
are `vehicle_plate`, `vehicle_make_model`, `vehicle_colour`, `vehicle_fuel_type`;
the pick-up agent is `departure_agent`. There is no opaque JSON `terms` column.

Rates use `rate_1_3`, `rate_4_7`, `rate_extra_day_1`, `rate_extra_day_2`,
`rate_package_price`, `rate_package_days`, `rate_km_included`, `rate_extra_km`.
Every PricingLines member is a separate `numeric(10,2)` column, prefixed
`pricing_` in `contract_revisions` and `final_pricing_` in `inspections`.
For example the two rental amounts are `pricing_rental` and
`final_pricing_rental`; the final damage sum is `final_pricing_damage`.
The feature functions will populate the billed-damage sum (US-073); the schema
stores it without implementing that transition.

`stored_signatures.capture_place` and `capture_agent_name` preserve the place
and staff name shown on the authorisation. Cancellation metadata is stored as
`cancelled_at`, `cancelled_by`, `cancel_reason`. Document edition time is
`contract_documents.created_at`. All tables also have creation attribution.

All names and address lines are at most 80 characters; comments and additional
information at most 500; phone strings 40; email 254; storage paths 1024.
General-terms pages have a separate aggregate limit of 200,000 characters across
at most 20 pages. File metadata does not implement uploads or bucket policies.

Signature rows and stored drawings also record `strokes_sha256`,
`image_size_bytes` and `strokes_size_bytes`. Generated PDF rows record
`size_bytes`; creation metadata identifies the uploader and edition time.
