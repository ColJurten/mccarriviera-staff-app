# Contract template v1: field map

Every field of the new contract PDF: where it sits, its label in each language, which template it comes from, when it is filled, and where the value is stored.

- **Decision (2026-11-02, R-02):** the new template is the model template plus every field of the current form. All of the model's fields are kept.
- **Layout:** the model's presentation, as one topic per page, label/value tables, the logo at the top right, a contact footer and a signature on every page. The signature block sits at the bottom right of every page (F-08).
- **Specimens:** [`samples/`](samples/). How to rebuild them: [`README.md`](README.md).

**Source:** C = current form (`current_template.pdf`) · M = model template (`model_template.pdf`) · C + M = on both, merged into one field · Decision = required by a decision, not printed on either form.
**When:** D = Départ · R = Retour · A = amendment · S = settings or fixed text · C = computed by the app.
**Stored in:** working names from US-006. **New** marks a column the current data model doesn't have yet.

## Every page

| Element | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Logo, top right | — | — | C + M | S | company config | Placeholder until the brand assets arrive (R-18) |
| Document title | Contrat / facture location | Rental contract / invoice | C | S | i18n | Title kept, as decided in B-04 (L-04) |
| Page title | Contrat de location, Conditions financières… | Rental agreement, Rates and payment… | M | S | i18n | One topic per page, as on the model |
| Contract number | N° de contrat | Contract no. | M (Reservation no.) | D | `contracts.number` | `MCR-YYYY-NNNN` (R-09), reserved when the preview to sign is created, since the sealed PDF carries it (F-18) |
| Revision | Révision | Revision | Decision | A | `contracts.current_revision_no` | ADR-0007 |
| PDF stage | PDF du départ / PDF final | Pick-up PDF / Final PDF | Decision | — | `contract_documents.stage` | ADR-0010 |
| Signature block, bottom right | Signature départ · Signature retour | Pick-up signature · Drop-off signature | C (S1–S4) + M (one per page) | D, R | `signatures` | Documenso's signature fields sit in these boxes (ADR-0020); the final PDF repeats the departure signature image read back from Documenso (F-17). Same position in FR and EN. Amendment pages show the amendment's signature or « Sans signature du client » instead of the departure one (ADR-0009) |
| Signature date and time | Signé le … | Signed on … | Decision | D, R | `signatures.signed_at` | Server time, when Documenso reports the signature; Documenso also prints its own times on its certificate page |
| Footer: company identity | Name, address, SIRET, APE, phones, website | same | C (header) + M (footer) | S | [`config/company.json`](config/company.json) | Copied from the current form, to be confirmed by the client; e-mail unknown |
| Footer: page, edition date, template and terms versions | Page n / N · Édité le … · modèle v1 · CGV FR v1 | Page n of N · Issued on … · template v1 · terms EN … | Decision | — | `contract_documents` | ADR-0010. The terms version is the one printed in that PDF's language |

## Page 1: Contrat de location (the model's page 1)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Pick-up place | Lieu de départ | Pick-up location | M | D | `terms.pickup_place` **New** | Free text (R-05) |
| Departure date and time | Date & heure de départ | Pick-up date & time | C + M | D | `terms.departure_at` | |
| Return place | Lieu de retour | Drop-off location | C + M | D, A | `terms.return_place` | |
| Planned return | Retour prévu | Planned return | C + M (Drop off date) | D, A | `terms.planned_return` | Page 1 keeps the value signed at the Départ; changes go on amendment pages |
| Number of days | Nombre de jours | Number of days | M | D, A | `terms.rental_days` **New** | Typed by staff (F-06) |
| Flight or train | Vol / train | Flight / train | M | D | `terms.flight_train` **New** | Optional |
| Intermediary, phone | Intermédiaire · Tél. | Intermediary · Phone | C | D | `terms.intermediary`, `terms.intermediary_phone` | R-08 |
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
| ID document dates | Délivrance / expiration | Issued / expires | M | D | `clients.id_doc_issued_on`, `clients.id_doc_expires_on` **New** | Optional |
| Driving licence number | Permis de conduire n° | Driving licence no. | C + M | D | `clients.licence_number` | |
| Licence dates | Délivrance / expiration | Issued / expires | M | D | `clients.licence_issued_on`, `clients.licence_expires_on` **New** | The issue date makes the « permis de plus d'un an » rule of the terms (Art. 1) checkable; the app only records it (R-04) |
| Additional information | Informations complémentaires | Additional information | M | D | `terms.additional_info` **New** | `INTERPRETATION`: per rental, not per client, so it never goes stale |
| Additional driver | 2e conducteur: Nom et prénom · Date de naissance · Permis n° | Second driver: Full name · Date of birth · Licence no. | C (name, date of birth, licence) + M (name) | D, A | `contract_drivers` → `clients` | One additional driver (R-03) |
| Services included | Services inclus | Services included | M | D | `terms.services_included` **New** | Free text typed by staff, for example the insurance cover |
| Security deposit | Dépôt de garantie | Security deposit | M (Deposit), and CGV Art. 7 « fixé au recto » | D | `terms.deposit` **New** | Amount only; the deposit itself is taken outside the app (B-10). How it relates to « Total prépayé » is still R-07 Q1 |
| Make and model | Marque & modèle | Make & model | C + M | D | snapshot of `vehicles.make_model` | |
| Licence plate | Immatriculation | Licence plate | C + M | D | snapshot of `vehicles.plate` | |
| Colour | Couleur | Colour | C | D | snapshot of `vehicles.colour` | |
| Fuel type | Carburant | Fuel type | C + M | D | snapshot of `vehicles.fuel_type` | |
| Pick-up agent | Agent au départ | Pick-up agent | M (Pick-up driver) | D | `staff_profiles.display_name` **New**, snapshot at signature | R-19 Q1 answered: the staff name is printed |
| Key terms box | Rappel des conditions générales | Key points of the general terms | M (its rules paragraph), rewritten from MC Car Riviera's own terms | S | i18n | Six points from Art. 2, 6, 8, 9 and 10. The model's own wording isn't copied (another company's text, Swiss law). To validate (L-02) |
| Declaration next to the signature | Déclaration: « Je déclare avoir lu et compris le présent contrat… » | Declaration | M | S | i18n | New wording adapted from the model; to validate (L-02) |

## Page 2: Conditions financières (from the current form)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Daily rates | Tarif / jour 1 à 3 j · 4 à 7 j | Daily rate 1–3 days · 4–7 days | C | D | `terms.rates.rate_1_3`, `rate_4_7` | |
| Extra day (row 2) and km included | Jours sup. · Km inclus | Extra day · Km included | C | D | `terms.rates.extra_day_1`, `km_included` | « Kms inclus » also appears on page 3, same value |
| Package | Forfait … pour … jours | Package … for … days | C | D | `terms.rates.package_price`, `package_days` | |
| Extra day (row 4) and extra km | Jours sup. · Km sup. | Extra day · Extra km | C | D | `terms.rates.extra_day_2` **New**, `extra_km` | The form has two « Jours sup » rows; both are kept as typed fields (B-05) |
| Deductible card | Franchise minimum: Carte VISA / AMEX / AUTRE | Minimum deductible: Card | C | D | `terms.card_brand` | R-07 Q3 |
| Deductible amounts | Vol · Accident responsable | Excess theft · Excess at-fault accident | C | D | `terms.deductible_theft`, `deductible_accident` | |
| Payment method | ESP · CC | Cash · Card | C | D | `terms.payment_method` | |
| Card imprint | Empreinte carte de crédit, type de carte | Credit card imprint, card type | C | D | `terms.card_brand`, `terms.card_last4` | Brand and last four digits only (F-09) |
| Card expiry | Date de validité | Expiry date | C | D | `terms.card_expiry` | MM/YY (F-09) |
| CVV | CVV | CVV | C | — | none | Printed, always empty (F-09) |
| Charges at the Départ | Tarification, column « Au départ »: Location, J / sup, Km sup, Total H.T. location, Assurance −25 ans, Conducteur sup., Livraison, Option I–III, Carburant, Divers, Total H.T., TVA 20 %, Total TTC, Total prépayé, Solde | Charges, column "At pick-up" | C | D | revision snapshot `terms.pricing` | Typed by staff (F-06) |
| Final statement | Column « Décompte final », same lines | Column "Final statement" | C (filled at the Retour on paper) | R | `inspections.final_pricing` (return) | Typed by staff (F-06). Empty in the Départ PDF |
| Acceptance text | Acceptation: « J'ai lu et accepté les conditions stipulées ci-contre et au verso… » | Acceptance | C | S | i18n | Verbatim from the current form. « ci-contre et au verso » no longer matches the layout, and the English version is a draft: both go to the lawyer (L-02, R-17) |

## Page 3: État du véhicule (the model's page 2)

| Field | FR | EN | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Contract summary | Rappel du contrat: N° de contrat, Locataire, Permis n°, Date de naissance, Délivrance / expiration, Marque & modèle, Immatriculation | Contract summary | M | — | as page 1 | Repeated from page 1, as on the model |
| Date and time | Date & heure, Départ and Retour columns | Date & time | C | D, R | `inspections.at` | |
| Agent | Agent | Agent | M | D, R | staff display name, snapshot | R-19 |
| Km out | Kms départ | Kms out | C + M (Kilometers) | D | `inspections.km` (departure) | |
| Km in | Kms retour | Kms in | C | R | `inspections.km` (return) | |
| Km driven | Kms parcourus | Kms driven | C | C | computed | Km in − km out (R-06) |
| Km included | Kms inclus | Kms allowed | C | — | `terms.rates.km_included`, after amendments | |
| Extra km billed | Kms facturés | Extra kms | C | C | computed | max(0, driven − included) (R-06) |
| Fuel | Jauge essence: eighths, with the percentage | Fuel gauge | C (eighths) + M (Tank reading %) | D, R | `inspections.fuel` | Stored in eighths (R-06); the percentage is computed (n × 12.5 %) |
| Car papers | Papiers du véhicule: Oui / Non | Car papers: Yes / No | M | D, R | `inspections.car_papers` **New** | CGV Art. 9 asks for the documents back |
| Clean inside | Propreté intérieure | Clean inside | M | D, R | `inspections.clean_inside` **New** | |
| Clean outside | Propreté extérieure | Clean outside | M | D, R | `inspections.clean_outside` **New** | |
| GPS | GPS / navigation | GPS / navigation | M | D, R | `inspections.gps` **New** | |
| Reference photos | Photos de référence, jeu du … | Reference photos, set of … | Brief, ADR-0008 (replaces the drawings of both forms) | D | `condition_baselines`, `photos` | 8 exterior angles + optional interior |
| Dashboard photo | Tableau de bord | Dashboard | F-10 | D, R | `photos` (kind dashboard) | Optional |
| Extra photos | Photos supplémentaires | Extra photos | B-09 | D | `photos` (kind extra) | With a comment; « importée » if picked from the library |
| Damage present at the Départ | Dommages existants au départ | Damage already present at pick-up | C (Descriptif véhicule) + ADR-0008 | D | `damages` open at the Départ | |
| New damage or RAS | Nouveaux dommages / RAS — Rien à signaler | New damage / Nothing to report | C (Descriptif véhicule, retour) + brief | R | `damages` found at the Retour, `inspections.ras` | |
| Comment | Commentaire | Comment | C (the two blank lines of each box) | D, R | `inspections.comment` | |
| Declaration next to the signature | « Je déclare avoir inspecté le véhicule au départ et/ou au retour et en accepter l'état. » | "I declare that I have inspected the vehicle…" | M | S | i18n | Matches CGV Art. 3; to validate (L-02) |

## Further pages

| Pages | Content | Source | When | Stored in | Notes |
|---|---|---|---|---|---|---|
| Conditions générales | The French terms, version v1, typed from the scan ([`terms/cgv-fr-v1.md`](terms/cgv-fr-v1.md)) | C (page 2, « au verso ») + M (page 3, signed) | S | `terms_versions.body_pages` | Stored already split into pages (US-041). Gaps in the scan are marked […]; the client's source file, then the lawyer's update (L-02), replace it. English: none yet (R-17) |
| Avenant n° … | One page per amendment: date, revision, agent, reason, each change as before → after | Decision (ADR-0007, ADR-0010); meeting notes « modification » | A | `contract_revisions` | Bottom-right block: the amendment's signature or « Sans signature du client », plus the return signature in the final PDF |
| Annexe photos | Every photo of the contract at full size, two per page, with stage, kind, angle, date and time | R-01 Q2 answered: thumbnails plus full-size pages | D, R | `photos` | Reference set, dashboard, extra photos and damage photos |

## Not carried over

| Item | From | Why |
|---|---|---|
| The model's own texts: rules paragraph, liability and traffic-violation paragraphs, terms URL, Swiss terms and conditions | M | Another company's wording, written under Swiss law (source analysis §3.1). Replaced by MC Car Riviera's own terms and texts |
| Car outline with damage marks; the page of drawings | M (page 2), C (pages 1 and 3) | Photos only (brief) |
| Fuel as a percentage only | M | Kept in eighths, with the percentage alongside (R-06) |
| Handwritten invoice reference (« FACT 1336 ») | C | Replaced by the contract number; whether it also replaces the invoice number is R-09 Q4 |
