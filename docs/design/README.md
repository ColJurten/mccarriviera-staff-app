# Design reference

What the front end needs from the design: the theme, the app shell and the list of screens. Written on 2026-11-14 from the developer's design file « McCar Riviera — App de location », which has two pages: « Mobile UI » (390 px wide, 33 screens) and « Web Desktop » (1440 px wide, 24 screens).

- The design file is private and coding agents can't open it. Until its screens are exported into this folder, build each screen from its story, the theme and the shell below.
- **The stories and the ADRs win.** Where the design differs, follow § Differences and don't copy the design.
- [`maquette-basse-fidel.png`](maquette-basse-fidel.png) and its Excalidraw source are the first low-fidelity wireframe (October 2026). The design file replaced them.

## Theme

Dark, with a gold accent. These values are the placeholder theme of R-18, until the client's brand assets arrive. Keep them as theme tokens in one place ([US-003](../stories/US-003-expo-app-skeleton.md)); no screen writes a colour or a font by hand.

| Token | Value | Used for |
|---|---|---|
| Background | `#0C0B0A` | Page background |
| Surface, low | `#0F0E0C` | Sidebar, tab bar, top bar |
| Surface | `#121110` | Tables and list containers |
| Card | `#151412` | Cards and panels |
| Field | `#1A1815` | Inputs, secondary buttons, hovered rows |
| Selected | `#1F1B14` | Selected navigation entry or list row |
| Border, faint | `#1F1C18` | Dividers |
| Border | `#262320` | Cards and tables |
| Border, field | `#2F2B25` | Inputs and chips |
| Border, strong | `#3A3226` | Secondary buttons |
| Border, gold | `#5A4A2B` | Outlined gold buttons, selected rows |
| Accent | `#C9A45C` | Primary buttons, links, active tab, overlines |
| Accent, light | `#E3C98E` | Text on dark gold surfaces, hovered links |
| On accent | `#14110C` | Text on a gold or orange surface, signature ink |
| Text | `#F3EEE4` | Main text |
| Text, secondary | `#C8C1B4` | Secondary text |
| Text, muted | `#A39C8E` | Labels, captions, inactive tabs |
| Placeholder | `#918A7D` | Input placeholders |
| Attention | `#E0894A` · light `#F0A774` | « À signer », maintenance, counters |
| Info | `#84AAD6` · light `#A9C6E8` | Rented vehicles |
| Paper | `#FAF8F3` | Signature pad, PDF pages |

- **Fonts:** Cormorant Garamond 600 for titles and the wordmark (fallback Georgia, serif); Manrope 400 to 700 for everything else (fallback system-ui). Bundle the fonts with the app; don't load them from a third party at run time (`RECOMMENDED`, [ADR-0021](../adr/0021-web-app.md) security headers).
- **Type scale:**
  - screen title: 40 px on wide screens, 34 px on narrow ones;
  - section title: 30 px;
  - overline above a title: 12 px, weight 700, letter-spacing 0.2 em, in the accent colour, in capitals;
  - body: 14 to 15 px; captions: 12 to 13 px;
  - field labels and table headers: 11 px, weight 600 to 700, letter-spacing 0.1 em, in capitals.
- **Shapes:** radius 12 for inputs and buttons, 14 to 18 for cards, 20 to 22 for the large Départ and Retour cards, full for chips and badges.
- **Sizes:** buttons and inputs are 44 to 52 px high; nothing a finger taps is smaller than 44 px.
- **Status badges:** a chip with a dot. Gold for « Disponible » and signed, blue for a rented vehicle, orange for maintenance and for anything waiting for a signature, grey for closed.

## App shell

Four destinations, in this order: **Accueil**, **Véhicules**, **Clients**, **Contrats**. « Contrats » carries an orange counter of the contracts waiting for a signature ([US-065](../stories/US-065-contrats-list-and-contract-detail.md)).

- **Narrow screens** (phones): a bottom tab bar with four equal tabs, each an icon above an 11 px label, 56 px high, on the low surface with a top border. The active tab is in the accent colour. A top bar shows the wordmark « McCar RIVIERA », centred.
- **Wide screens:** a left sidebar, 232 px wide, on the low surface: the wordmark, then two buttons side by side, « Départ » (filled gold) and « Retour » (outlined gold), then the four destinations as a vertical list. The active entry uses the selected colour. The content has 40 px of padding and is at most 1,200 px wide.
- **Départ and Retour flows** replace the shell with a top bar: the wordmark, the numbered steps of the flow, and « Quitter ». Départ has five steps: Véhicule, Client, Tarif, Aperçu, Signature. Retour has four: Véhicule, Informations, Aperçu, Signature.
- **Lists with a detail** (vehicles, clients, contracts): on wide screens, the list on the left and the selected item's detail on the right; on narrow screens, the list, then the detail as its own screen.
- **Windows:** on wide screens, « Dommage constaté » at the Départ and « Client pressé » at the Retour open as a window over the preview; on narrow screens they are full screens.

The breakpoint between narrow and wide is set once in the theme ([ADR-0025](../adr/0025-web-app-first.md)).

## Screens

| Area | Phone screens | Web Desktop screens | Stories |
|---|---|---|---|
| Home | Accueil | Accueil | US-020, US-021 |
| Vehicles | Onglet Véhicules, Fiche véhicule, Ajout d'un véhicule, Modification, Photos état (carrousel, détail) | Véhicules (liste + fiche), Ajout, Modification, Photos état (visionneuse) | US-021 to US-027 |
| Clients | Onglet Clients, Fiche client, Ajout d'un client, Modification | Clients (liste + fiche), Ajout, Modification | US-030 to US-034 |
| Contracts | Onglet Contrats, Brouillon à signer, Modification du brouillon, PV de retour à finaliser, Contrat signé | Contrats (liste + détail), Modification du brouillon | US-065, US-056, US-058, US-076 |
| Départ | Véhicule, Client, Second conducteur, Tarif, Aperçu PDF, Dommage constaté, Signature, PDF signé | Départ 1 to 5, Dommage constaté (fenêtre), PDF signé | US-050 to US-058, US-044 |
| Retour | Véhicule, Informations, Dégâts (choix photo, photo et estimation, validation), Aperçu PDF, Client pressé, Signature, PDF signé | Retour 1 to 4, Dégâts, Client pressé (fenêtre), PDF signé | US-070 to US-076, US-044 |

Not drawn yet, to build from their stories with the same theme: sign-in and the authenticator set-up (US-010, US-015), settings and sign-out, client documents (US-033), extending a rental (US-061), voiding (US-062), copies in the other language (US-063), maintenance (US-080 to US-083), and archiving a vehicle (US-025).

## Differences: the stories win

| In the design | What to build | Why |
|---|---|---|
| Numbers such as CT-2026-118 for a contract and PV-2026-087 for a return | One number per rental, `MCR-YYYY-NNNN`, on the departure PDF and on the final PDF | R-09, confirmed on 2026-11-14 |
| File names such as `Contrat_GA-311-RV_02-11-2026.pdf` | `{contract number}_{depart\|final}_{fr\|en}.pdf` | [US-042](../stories/US-042-archive-and-share-pdfs.md) |
| « Envoyer un lien au client » (e-mail, SMS, QR code) on the web signature step, and « Envoyer le lien de signature » on a contract | The signature pad only | F-30: a signing link is post-MVP |
| « PV de retour » shown as its own document | The Retour belongs to its contract; its PDF is the contract's final PDF | [ADR-0007](../adr/0007-contract-lifecycle-and-audit.md), [ADR-0010](../adr/0010-contract-pdf-generation.md) |
| One « À signer » state for a draft and for a contract waiting for its signature | Two states: a draft has no number yet; « En attente de signature » has one | F-18, [US-065](../stories/US-065-contrats-list-and-contract-detail.md) |
| An availability date for a vehicle in maintenance | No date: a maintenance has no planned end (default for R-14) | [US-080](../stories/US-080-put-a-vehicle-into-maintenance.md) |
| « En location » on a rented vehicle | « En cours », as in the stories and the glossary | [US-020](../stories/US-020-home-screen.md) |
| No French/English switch on the preview | The preview has the switch | F-17, [US-044](../stories/US-044-client-signs-in-the-app.md) |
| A fuel gauge labelled E, ¼, ½, ¾, F | Eighths, from 0 to 8, with those labels as marks | [ADR-0011](../adr/0011-localisation.md) |

« Pièces jointes » on a vehicle is followed: vehicle documents are in the MVP since 2026-11-14 (F-32, [US-027](../stories/US-027-vehicle-documents.md)).
