# Glossary: French / English rental vocabulary

Terms as they appear in the brief, the current contract (`current_template.pdf`), its general terms (CGV) and the
meeting notes. Code and the database use English identifiers. The UI and the contract use the French or English
labels below.

## Workflow

| French | English | Meaning in this project |
|---|---|---|
| Départ | Check-out / pick-up | Start of a rental: vehicle handed over, contract signed |
| Retour | Check-in / return / drop-off | End of a rental: return km, fuel and condition recorded |
| Restitution | Return (of the vehicle) | CGV Art. 9: returning car, keys and papers ends the rental |
| Prolongation | Extension | CGV Art. 8: extending the rental period |
| Avenant | Amendment | A change to a signed contract, stored as a new revision in the app. It is not printed as a page; its effect shows in the final statement (ADR-0007, F-22) |
| Photos de référence | Reference photo set | The vehicle's current set of condition photos, reused at each Départ: front, rear, left and right required, the others optional. Database table `condition_baselines` (ADR-0024, F-23) |
| Dommage constaté au départ | Damage found at pick-up | Damage the client or staff spot at a Départ that wasn't on record: a damage record, never charged to that renter (ADR-0024, F-25) |
| Dommages déjà présents au départ | Damage already present at pick-up | Damage open when a rental starts. In the final PDF it moves to its own annex, after the new damage (F-24) |
| Estimation (indicative · facturée) | Estimate (indicative · billed) | An optional amount on a new damage found at the Retour. Indicative: printed as an estimate, the final cost invoiced after the repair. Billed: added to the « Dommages » line of the final statement (ADR-0024, F-24) |
| Décompte final | Final statement | The pricing lines as completed at the Retour, printed next to the departure charges on page 1 (F-22) |
| Importée | Imported | A photo picked from the phone's library rather than taken in the app (ADR-0014) |
| État des lieux | Condition inspection | Inspection at départ or retour |
| Descriptif véhicule | Vehicle condition description | The condition boxes on the current form |
| Dégât | Damage | |
| Éraflure · Bosse · Manque | Scratch · Dent · Missing part | Legend of the current damage diagram (to be replaced by photos) |
| RAS (Rien à signaler) | Nothing to report | Return inspection with no new damage |
| Retour en attente de signature | Check-in awaiting signature | Return data entered, but the client hasn't signed yet. The car stays « En cours » (F-04) |
| En attente de signature (contrat) | Awaiting signature | The Départ's preview exists and the contract number is reserved; the client hasn't signed yet (F-18) |
| Annulé avant signature | Cancelled before signature | A contract that was never signed, kept with its number, never deleted (F-18) |
| Retiré | Withdrawn | A photo or a damage added by mistake during a Départ or a Retour and taken back before the client signs. It is kept and audited, and left off the PDF (R-10 Q5) |
| Contrats (onglet) | Contracts (destination) | The list of every contract, with what waits for a signature under « À signer » ([US-065](stories/US-065-contrats-list-and-contract-detail.md)) |
| Signature enregistrée | Stored signature | A client's drawing recorded at the drop-off, after they sign an authorisation, and applied by staff to the finished Retour. One Retour only, used once; a feature switched on per company (ADR-0023, F-28) |
| Autorisation de signature | Signature authorisation | The text the client signs before their signature is stored; printed as a page of the final PDF (F-28, L-01) |
| Reset (du statut / de l'état) | Status / baseline reset | Brief: new reference condition photos after a damage repair, only when appropriate. Meeting notes: « Reset status ou pas » next to Maintenance |

## Vehicle statuses (meeting notes, plus « Archivé »)

| French | English | Note |
|---|---|---|
| Dispo(nible) | Available | Database code `available` |
| En cours | Rented / in use | `INTERPRETATION` of the handwriting « Encours ». Used as the app's badge label. Database code `rented` |
| Maintenance | Maintenance | Database code `maintenance` |
| Archivé | Archived | Sold or retired, kept for history. Database code `archived` (default for R-13) |

## People and parties

| French | English | Meaning |
|---|---|---|
| Locataire / Rentier / Conducteur | Renter / main driver | The client signing the contract |
| 2ème conducteur · Conducteur sup(plémentaire) | Additional driver | Also a pricing line (« Conducteur sup ») |
| Intermédiaire | Intermediary | Printed on the form. Exact meaning is open (R-08) |
| Loueur · Société de location | Lessor · Rental company | MC Car Riviera |
| Agent au départ · Agent au retour | Pick-up agent · Drop-off agent | The staff member who handled the handover, printed on the contract (R-19); the model template's "Pick-up driver" |

## Client data

| French | English |
|---|---|
| Adresse de facturation | Billing / home address |
| Adresse locale | Local / contact address during the stay |
| Permis de conduire | Driving licence |
| Carte d'identité · Passeport | ID card · Passport |
| Date de naissance | Date of birth |
| Civilité (M. · Mme) | Title (Mr · Ms) |
| Délivrance · Expiration | Issue · Expiry (of an ID document or a licence) |

## Vehicle, mileage and fuel

| French | English | Meaning |
|---|---|---|
| Immat(riculation) | Registration plate | |
| Modèle | Model | Make + model on one line on the current form |
| Kms départ · Kms retour | Km out · Km in | Odometer at check-out and check-in |
| Kms parcourus | Km driven | Km in − km out (computed) |
| Kms inclus · Droit de km | Km allowance | Km included in the price |
| Kms facturés | Extra km billed | Km driven above the allowance |
| Jauge essence | Fuel gauge | Eighths from E to F on the current form |
| Sans plomb 95 | Unleaded 95 | Fuel type |
| Carburant | Fuel | Also the refuelling charge line |
| Papiers du véhicule | Car papers | Vehicle documents on board, checked at each handover (R-02) |
| Propreté intérieure · extérieure | Clean inside · outside | Checked at each handover (R-02) |

## Pricing and payment

| French | English | Meaning |
|---|---|---|
| Tarif/J. (1 à 3 j · 4 à 7 j) | Daily rate (1–3 days · 4–7 days) | Two rate tiers |
| Jour(s) sup | Extra day(s) | |
| Km sup | Extra km | Price per extra km |
| Forfait … € pour … jours | Package: … € for … days | |
| Location | Rental | Base rental amount |
| Assurance −25 ans | Young-driver insurance | Surcharge for drivers under 25 |
| Livraison | Delivery | Delivering the car to the client |
| Option I / II / III | Options | Unnamed option lines |
| Divers | Miscellaneous | |
| HT · TVA · TTC | Excl. VAT · VAT · Incl. VAT | VAT printed at 20 % |
| Total prépayé | Prepaid total | Printed sub-label says "Total deposit". Meaning is open (R-07) |
| Solde | Balance due | |
| Franchise (vol · accident responsable) | Deductible / excess (theft · at-fault accident) | Renter's maximum liability (CGV Art. 5-4) |
| Dépôt de garantie | Security deposit | CGV Art. 7. Printed on page 1 of the new contract (R-02); taken outside the app |
| Services inclus | Services included | Free text on the new contract, for example the insurance cover (R-02) |
| Décompte final | Final statement | The pricing lines as completed at the Retour, next to the amounts typed at the Départ |
| Loyer provisionnel | Provisional rent | CGV Art. 6: paid up front, adjusted at the end |
| Mode de paiement: ESP · CC | Payment method: cash · card | |
| Empreinte carte de crédit | Card imprint | Imprint area on the current form. In the app it shows the card brand and the last four digits only (F-09) |
| v.a.d. (vente à distance) | Remote (card-not-present) charge | |
| Facture | Invoice | The current form is titled « Contrat / Facture location » (B-04) |

## Documents

| French | English |
|---|---|
| Contrat de location | Rental agreement / contract |
| CGV, Conditions générales de location | General terms and conditions of rental |
| Recto · Verso | Front · Back (of the paper contract) |
| Annexe photos | Photo annex | The last pages of the contract PDF: every photo at full size (R-01 Q2) |
| Spécimen | Specimen | A sample PDF filled with invented data, never a real contract |
| Pièces jointes (véhicule) | Vehicle documents | The registration, the insurance and other files attached to a vehicle (F-32) |

## Technical terms

| Term | Meaning in this project |
|---|---|
| API (server) | The developer's own back end, in TypeScript with Fastify: logins, permission checks, file links, PDF rendering, stamping and sealing ([ADR-0019](adr/0019-backend-own-api-postgres-s3.md)) |
| Signature pad · Pavé de signature | The full-screen area where the client draws their signature once, in the app or the web app ([ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| Preview · Aperçu | The PDF the API renders before signing, stored with its SHA-256. The client signs exactly that file; a change or a language switch makes a new one ([ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| Sealed PDF · Cachet PAdES | The signed PDF, with the drawing stamped on every page and a digital seal over the whole file: any later change is detectable. Sealed by the API with the company's certificate |
| Timestamp · Horodatage | A time certified by a timestamping authority (RFC 3161), embedded in the seal ([ADR-0023](adr/0023-signatures-in-the-app-sealed-by-the-api.md)) |
| Signature certificate page | The page the API appends after the contract's numbered pages: who signed, when, on which device, in which mode, and the files' hashes |
| Documenso | The open-source signing application chosen on 2026-11-03 and dropped on 2026-11-10, after the spike showed one tap per page (ADR-0020, superseded) |
| Self-signed certificate | The company's own sealing certificate, not issued by a recognised authority: the seal is intact, but Adobe Reader shows the company's identity as unverified (F-17, L-01) |
| Presigned link | A temporary link (5 minutes at most) to one private file, issued by the API after its checks ([ADR-0014](adr/0014-file-storage.md)) |
| Staging | The test environment, on the developer's homelab, with invented data only (F-14) |
| Web app | The same app in a browser, for staff laptops and the agency computer (F-19, [ADR-0021](adr/0021-web-app.md)) |
| Second factor (TOTP) | A one-time code from an authenticator app, asked at every new native and web sign-in (ADR-0012, developer decision PR #25) |
| Garage · Mailpit | The local stand-ins for S3 storage and for the e-mail server, in the developer's local stack (F-20) |

Authentication uses password plus TOTP (or a one-use backup code) at every new
native or web sign-in. Face ID/Touch ID only unlocks the local iPhone app
([ADR-0012](adr/0012-authentication-and-authorisation.md), PR #25).
