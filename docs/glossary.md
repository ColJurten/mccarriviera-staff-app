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
| Avenant | Amendment | A change to a signed contract, stored as a new revision and printed on its own page (ADR-0007, F-08) |
| Photos de référence | Reference photo set | The vehicle's current set of condition photos, reused at each Départ. Database table `condition_baselines` (ADR-0008) |
| Décompte final | Final statement | The pricing lines as completed at the Retour, printed in the Retour section (F-08) |
| Importée | Imported | A photo picked from the phone's library rather than taken in the app (ADR-0014) |
| État des lieux | Condition inspection | Inspection at départ or retour |
| Descriptif véhicule | Vehicle condition description | The condition boxes on the current form |
| Dégât | Damage | |
| Éraflure · Bosse · Manque | Scratch · Dent · Missing part | Legend of the current damage diagram (to be replaced by photos) |
| RAS (Rien à signaler) | Nothing to report | Return inspection with no new damage |
| Retour en attente de signature | Check-in awaiting signature | Return data entered, but the client hasn't signed yet. The car stays « En cours » (F-04) |
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

## Technical terms

| Term | Meaning in this project |
|---|---|
| API (server) | The developer's own back end, in TypeScript with Fastify: logins, permission checks, file links, PDF rendering and the link to Documenso ([ADR-0019](adr/0019-backend-own-api-postgres-s3.md)) |
| Documenso | The open-source signing application, hosted next to the API. The client signs in it, on the staff phone ([ADR-0020](adr/0020-signatures-with-documenso.md)) |
| Envelope | Documenso's word for a document sent for signature, with its signers and signature fields |
| Sealed PDF · Cachet PAdES | The signed PDF that Documenso returns, with a digital seal over the whole file: any later change is detectable. Sealed with the company's certificate |
| Self-signed certificate | The company's own sealing certificate, not issued by a recognised authority: the seal is intact, but Adobe Reader shows the company's identity as unverified (F-17, L-01) |
| Presigned link | A temporary link (5 minutes at most) to one private file, issued by the API after its checks ([ADR-0014](adr/0014-file-storage.md)) |
| Staging | The test environment, on the developer's homelab, with invented data only (F-14) |
