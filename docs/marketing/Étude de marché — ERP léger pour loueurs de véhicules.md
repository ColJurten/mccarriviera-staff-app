# Étude de marché — ERP léger pour loueurs de véhicules
## Côte d’Azur, puis petites entreprises françaises

**Date de l’étude : octobre 2026**  
**Périmètre : entreprises de 5 à 100 véhicules, une ou quelques agences, faible à moyen volume de location**

> **Convention de lecture.** Les éléments présentés comme **faits sourcés** proviennent des pages officielles citées en références. Les **estimations** sont des scénarios de travail, non des statistiques observées. Les **recommandations** sont des choix à tester sur le terrain. Lorsqu’une information concurrente n’est pas publique, elle est indiquée comme « non public » plutôt que déduite.

## Résumé exécutif

Le marché initial pertinent n’est pas « tous les loueurs automobiles » mais les petites structures qui ont assez de complexité opérationnelle pour souffrir d’Excel, WhatsApp et d’outils séparés, sans avoir les moyens, le volume ou l’appétence pour un système enterprise. L’ICP prioritaire est une entreprise de **10 à 50 véhicules**, mono-agence ou deux sites, exploitée par le dirigeant et une petite équipe, avec un besoin simultané de planning, contrats, états des lieux et facturation simple. Les entreprises de 5 à 9 véhicules constituent un marché d’entrée sensible au prix ; celles de 51 à 100 véhicules sont un marché d’expansion plus exigeant en droits, multi-site, intégrations et reporting.

La demande est réelle mais déjà concurrentielle. TEORI et Fleetee affichent des prix français publics particulièrement bas et couvrent une grande partie du socle métier : réservation, contrats, flotte, maintenance/alertes, états des lieux, photos, dommages et facturation [1][2]. TopRentApp, RentSyst et Renthub élargissent la couverture à l’international et aux intégrations, avec des niveaux de documentation et de localisation française variables [3][4][5]. Booqable est une alternative généraliste de location rapide à déployer, mais moins automobile-spécifique sur les contrôles, la maintenance et les dommages [6]. Odoo Rental peut couvrir un périmètre plus large, au prix d’un paramétrage et d’une implémentation supérieurs [7].

**Conclusion provisoire : go conditionnel.** Il n’est pas recommandé de lancer un simple « planning + contrats » : cette promesse est déjà banalisée. Une offre nouvelle peut cependant trouver sa place si elle est **plus simple à déployer et à utiliser que les ERP configurables**, plus **française et intégrable** que les alternatives internationales, et plus **modulaire/transparentement tarifée** que les solutions verticales enrichies. Le différenciateur initial recommandé est un parcours mobile et probant « départ-retour-dommage-facture », relié à une disponibilité fiable et à une maintenance pragmatique, avec import Excel/WhatsApp et accompagnement local.

## 1. Recentrage du marché adressable

### 1.1 ICP prioritaire

**ICP cœur — “petit loueur sous tension administrative”**

- 10 à 50 véhicules ; extension possible jusqu’à 100.
- Une agence principale, éventuellement un point de remise ou une seconde agence.
- Véhicules particuliers, premium, utilitaires ou flotte mixte ; faible à moyen volume de locations.
- Gestion actuelle par Excel/Google Sheets, messagerie, documents Word/PDF, terminal de paiement et logiciel comptable séparés, ou logiciel existant jugé trop cher/complexe.
- Décideur : dirigeant, responsable d’agence ou responsable de flotte ; pas de DSI dédiée.
- Besoin de mise en route en quelques jours ou semaines, avec migration simple et support humain.
- Clientèle locale, touristique, professionnelle ou mixte ; parfois internationale et multilingue.

**ICP d’entrée — micro-loueur structuré** : 5 à 9 véhicules, souvent saisonnier ou spécialisé, très sensible au prix et au temps d’apprentissage. Le produit doit proposer un parcours minimal sans facturer une sophistication inutile.

**ICP d’expansion — PME locale** : 51 à 100 véhicules, plusieurs utilisateurs/sites, plus de volume et de coordination. Le besoin se déplace vers les droits, les exports, la maintenance planifiée, le contrôle des coûts et les intégrations.

### 1.2 Personas et problèmes

| Persona | Situation | Problèmes observables | Décision attendue |
|---|---|---|---|
| Dirigeant-loueur | Gère ventes, planning et litiges au quotidien | Double saisie, visibilité partielle, dépendance à une personne, marge inconnue | ROI rapide, prix lisible, migration sans projet |
| Responsable d’agence | Coordonne départs, retours, clients et véhicules | Retards, véhicules indisponibles mal signalés, contrats manquants, photos dispersées | Workflow mobile, alertes, checklist et historique |
| Responsable de flotte | Suit entretien, contrôle technique, kilométrage et immobilisation | Échéances oubliées, coûts non rattachés, véhicule loué malgré maintenance | Planning d’indisponibilité et maintenance utile, non une GMAO lourde |
| Assistant administratif/comptable | Produit contrats, factures, remboursements et justificatifs | Ressaisie, erreurs de TVA, pièces difficiles à retrouver | Facturation simple, exports comptables et traçabilité |
| Client/conducteur | Signe, récupère, restitue et peut contester un dommage | Parcours lent, documents éparpillés, litige sur l’état initial/final | Signature, preuve photo et accès aux documents |
| Garage ou loueur adossé à un atelier | Loue des véhicules de remplacement | Location secondaire mal intégrée à l’activité principale | Solution légère, sans projet ERP complet |

### 1.3 Déclencheurs d’achat

**Faits de marché à vérifier en entretiens :** les déclencheurs les plus plausibles sont (i) une hausse des litiges de dommages, (ii) un audit ou une demande de justificatifs, (iii) le départ d’un salarié qui détenait les fichiers, (iv) une croissance au-delà de la capacité d’Excel, (v) l’ouverture d’une agence, (vi) une flotte immobilisée faute d’alerte, (vii) le renouvellement d’un logiciel trop cher, et (viii) l’obligation d’améliorer la facturation/les paiements.

**Hypothèse testable :** le déclencheur “réduire les litiges et les impayés” convertira mieux qu’un discours abstrait de “digitalisation”. La démonstration devrait commencer par un retour endommagé, produire la preuve et la facture, puis remonter vers le planning.

### 1.4 Exclusions du marché initial

- Réseaux nationaux ou internationaux nécessitant yield management avancé, réservations centralisées multi-pays, OTA complexes, télématique lourde, centre de contacts ou gouvernance groupe.
- Flottes de plus de 100 véhicules au lancement, sauf pilote à forte valeur.
- Activités principalement d’autopartage sans personnel, location de véhicules avec chauffeur, transport réglementé ou leasing financier.
- Entreprises exigeant une comptabilité générale complète dans le même produit.
- Clients recherchant une marketplace ou un channel manager comme besoin principal.
- Loueurs dont le processus est déjà industrialisé et satisfait par une solution spécialisée en place.

### 1.5 Taille de marché : scénario et proxy

Aucun chiffre direct fiable et publiquement comparable du nombre d’entreprises françaises correspondant exactement à « 5–100 véhicules, indépendantes, petites agences » n’est établi dans les éléments disponibles. Il faut donc présenter un **TAM/SAM/SOM par scénarios**, et non une fausse précision.

**Méthode recommandée de construction :** extraire de SIRENE les établissements dont l’activité relève de la location de voitures et véhicules légers, dédoublonner les agences appartenant à un même groupe, puis qualifier par téléphone/site web la taille de flotte, l’indépendance et le segment. Les codes d’activité seuls ne suffiront pas à distinguer location courte durée, leasing, concession, garage, gestion de flotte et franchisé.

**Scénario de travail à utiliser pour planifier, pas pour communiquer comme un fait :**

- **Univers Côte d’Azur qualifiable (proxy)** : 150 à 400 établissements potentiellement liés à la location automobile dans les Alpes-Maritimes et le Var, avant qualification. *Estimation illustrative à confirmer par SIRENE et appels ; elle ne constitue pas une statistique publiée.*
- **Part ICP 5–100 véhicules** : hypothèse de 25 % à 50 %, soit environ 40 à 200 entreprises.
- **SAM de lancement** : après exclusion des réseaux, des très grands comptes et des activités incompatibles, hypothèse de 30 à 120 comptes.
- **SOM 24 mois** : 5 à 15 % du SAM qualifié, soit 2 à 18 clients, selon capacité commerciale et partenaires. Ce scénario est volontairement prudent.
- **France à terme** : multiplier le raisonnement par bassins touristiques et urbains (Île-de-France, PACA, Auvergne-Rhône-Alpes, Occitanie, Nouvelle-Aquitaine, Corse), sans extrapoler mécaniquement le nombre Côte d’Azur.

**Économie indicative à tester :** à 99–199 € HT/mois par compte moyen, 10 clients représentent 1 000–2 000 € de MRR et 100 clients 10 000–20 000 € de MRR, hors onboarding, add-ons et services. Il s’agit d’une hypothèse de modèle économique, pas d’une prévision.

## 2. Segmentation Côte d’Azur

| Segment | Caractéristiques et besoin dominant | Attractivité initiale |
|---|---|---|
| Loueurs généralistes indépendants | 5–50 voitures, saisonnalité, clients touristes et locaux ; planning, contrats, caution, dommages et facturation | **Très forte** : meilleur cas d’usage cœur |
| Premium/luxe | Véhicules à forte valeur, clientèle internationale, exigences de preuve, options et conciergerie | **Forte mais exigeante** : panier supérieur, UX et traçabilité indispensables |
| Collection/expérience | Réservations événementielles, véhicules atypiques, prix et disponibilité sur mesure, photos nombreuses | **Moyenne à forte** : faible volume mais forte valeur unitaire |
| Utilitaires | Locations professionnelles, rotation, kilométrage, carburant, retours fonctionnels et disponibilité opérationnelle | **Forte** : douleur maintenance/immobilisation importante |
| Moyenne durée | Contrats plus longs, facturation récurrente, avenants, échéances et états intermédiaires | **Moyenne** : nécessite facturation récurrente et renouvellement |
| Gestionnaires de flotte/location saisonnière | Activité très saisonnière, renforts temporaires, nombreux retours concentrés, multi-sites occasionnel | **Forte pour un pilote local** : besoin de simplicité et de capacité en pic |

## 3. Parcours et besoins logiciels par segment

### 3.1 Parcours cible commun

1. Créer/importer véhicule, documents, caractéristiques et règles de disponibilité.
2. Recevoir une demande, vérifier disponibilité et tarif, créer une réservation/devis.
3. Collecter identité, permis, conducteurs additionnels, caution et paiement.
4. Générer et faire signer le contrat.
5. Réaliser l’état de départ sur mobile : kilométrage, carburant, propreté, photos et dommages.
6. Bloquer ou libérer le véhicule selon maintenance, nettoyage ou réparation.
7. Réaliser le retour : comparaison, photos, dommages, frais, carburant, kilométrage et signature.
8. Facturer, rembourser ou retenir tout/partie de la caution, puis envoyer les justificatifs.
9. Déclencher maintenance, alertes, relances et reporting.

### 3.2 MoSCoW par segment

| Segment | Must have | Should have | Could have | Won’t have au lancement |
|---|---|---|---|---|
| Généraliste | Planning, contrats, clients/conducteurs, états départ-retour, photos, dommages, facturation simple, alertes | Caution/préautorisation, réservation web, modèles multilingues, export comptable | Tarifs saisonniers, upsell, API | Yield management avancé, marketplace |
| Premium/luxe | Tout le socle + journal de preuve, signatures, assurance/franchise configurable, droits fins | CRM VIP, devis sur mesure, galerie photo, paiement international | Conciergerie, télématique, check-in sans personnel | Automatisations non auditables |
| Collection/expérience | Calendrier flexible, devis, contrats, photos, paiements, documents | Gestion d’options, itinéraires, événements, assurance spécifique | Portail partenaire, réservation par créneau | Tarification de masse |
| Utilitaires | Disponibilité, catégories, kilométrage, carburant, départ-retour, maintenance, facturation | Conducteurs multiples, amendes, contrats récurrents, immobilisation | GPS, intégration atelier | Fonctions luxe/conciergerie |
| Moyenne durée | Contrats et avenants, échéancier, factures récurrentes, alertes, états périodiques | Prélèvement, indexation, renouvellement, export comptable | Portail client, scoring risque | Moteur de réservation touristique complexe |
| Saisonniers/multi-sites | Disponibilité, rôles, mobile, photos, alertes, import/export, multi-agence basique | Tarifs saisonniers, réservation en ligne, rapports par site | Channel manager, keyless | ERP groupe et BI avancée |

## 4. Étude concurrentielle

Les prix ci-dessous sont des prix publiés observés dans les sources officielles disponibles ; lorsqu’ils varient selon options, devise ou devis, cela est précisé. Les fonctions sont celles documentées publiquement, non une garantie contractuelle exhaustive.

| Solution | Cible/prix | Réservation-contrats | Flotte-maintenance | Dommages/photos | Facturation/intégrations | Adéquation TPE/PME françaises | Faiblesse exploitable |
|---|---|---|---|---|---|---|---|
| **TEORI** | Loueurs/agences ; 19 € HT/mois 1–5 véhicules, 49 € 6–10, 89 € 11–20, 139 € 21–40, 219 € 41–100 ; essai 30 jours [1] | Planning, réservation, devis, contrats, signature ; réservation web | Parc, kilométrage, entretien et alertes annoncés | États départ/retour mobile, photos, dommages, PDF et signature [1] | Factures, Factur-X, Swikly, paiement en ligne ; API/comptabilité détaillée non public | **Forte** pour mono-site et budget réduit | Documentation publique limitée sur API, droits, multi-site, SLA, maintenance profonde et réversibilité |
| **Fleetee** | Indépendants/franchisés ; Manager 49/89/149 € HT/mois jusqu’à 20/50/100 ; Full 97/177/297 € ; essai 14 jours [2] | Planning, disponibilités, contrats, réservation/paiement web | Entretien, contrôles, coûts, blocage pendant maintenance | Fleetee Check mobile, photos, dommages, signature | Devis, factures, règlements, Swikly, API Web ; comptabilité française détaillée non public | **Forte** pour exploitation française et parcours de location | Coûts Keyless/Connect, droits, SLA, export comptable et workflow sinistre non publics |
| **TopRentApp** | Petites agences à réseaux ; Basic annuel 99 €/mois jusqu’à 10 véhicules, Pro annuel 139 € jusqu’à 30 puis 1,49 €/véhicule, Pro max 299 € ; essai 15 jours [3] | Réservations, calendrier, contrats multilingues, signatures/OTP | Rappels d’entretien et échéances annoncés | Checklists, rapports photo, dommages | Paiements, facturation, e-invoicing annoncée, API selon plan ; conformité française non documentée | **Bonne, conditionnelle** | Documentation et statut réel de comptabilité, maintenance, GPS, API et conformité française à vérifier |
| **RentSyst** | International ; 55 €/mois 0–15 véhicules, puis 3 €/véhicule 16–50 et 2,70 € 51–100 ; essai 14 jours [4] | Réservations, contrats numériques, signature, booking engine/API | Maintenance et rappels, GPS/télématique annoncés | Check-in/out, inspections, photos et descriptions | Paiements, e-invoicing, Peppol, comptabilité annoncés ; prix GPS et intégrations à clarifier | **Bonne** sur couverture, **incertaine** sur localisation française | Incohérence de calculateur, unité du coût GPS, conformité, SLA et coûts d’intégration non publics |
| **Renthub** | International ; base 45 €/mois + 1–4 €/véhicule selon modules ; devis personnalisé [5] | Réservations, e-commerce, contrats, signature, tarification dynamique | Entretien préventif/curatif et commandes garage annoncés | Restitution, dommages et frais annoncés ; détail photo non public | Facturation, paiements, Stripe et fonctions locales annoncées ; total et modules non publics | **Bonne mais potentiellement surdimensionnée** | Prix non transparent, nombreuses options, profondeur française et documentation opérationnelle limitées |
| **ReservationKey** | Petites entreprises ; 44 $/mois pour 10 unités, 174 $ pour 100, essai 30 jours [8] | Calendrier, inventaire, clients, moteur de réservation | Maintenance automobile non documentée | Dommages/photos et état des lieux non documentés | Paiements, QuickBooks, channel manager ; prix en USD et channel manager incohérent | **Faible à moyenne** pour ERP automobile complet | Outil surtout réservation/hospitality ; contrats, kilométrage, dommages et maintenance non démontrés |
| **Booqable** | SaaS de location généraliste ; 29 $/mois annuel Start, 69 $ Grow, 149 $ Scale ; essai 14 jours [6] | Disponibilité, devis, contrats, factures, e-signature, réservation web | Downtime et blocage maintenance ; GMAO automobile non documentée | Dépôt retenu, retour et stock ; photos/état des lieux riche non documentés | Stripe/PayPal, Xero, API, imports/exports | **Bonne** pour socle léger, **moyenne** pour automobile spécialisé | Pas de preuve publique sur permis, kilométrage, carburant, amendes, photos, sinistres, maintenance métier et conformité française |
| **Odoo Rental + Fleet** | ERP généraliste ; licence exacte non public dans les pages consultées ; implémentation à chiffrer [7] | Rental : devis, réservation, pickup/retour, prix, signature | Fleet : véhicules, contrats, coûts, carburant, odomètre, réparations, accidents | Accidents et pièces jointes ; parcours photo départ/retour et dommage client non démontré | Accounting, Inventory, eCommerce, Sign ; intégrations selon configuration | **Moyenne** : puissant mais paramétrage/implémentation | Complexité, coût total et délai ; absence de workflow automobile unifié prêt à l’emploi |

### 4.1 Lecture concurrentielle

- **Le prix d’appel n’est pas une barrière suffisante.** TEORI et Fleetee rendent crédible un socle complet sous 100–300 € HT/mois selon taille et modules [1][2].
- **La localisation est une opportunité.** Plusieurs solutions annoncent facturation, e-invoicing ou comptabilité, mais les formats français, exports, TVA, RGPD, hébergement, connecteurs comptables et conditions de support sont souvent non publics [3][4][5][6].
- **La preuve de dommage est un axe différenciant réaliste.** Les concurrents affichent photos et états des lieux, mais la profondeur du lien entre preuve, responsabilité, franchise, frais, facture, litige et assurance doit être comparée dans des démonstrations réelles.
- **La maintenance légère est plus pertinente qu’une GMAO complète.** Le besoin initial est surtout “ne jamais louer un véhicule bloqué et ne jamais oublier une échéance”, avec coûts et historique suffisants.

## 5. Concurrence indirecte

### Excel/Google Sheets + WhatsApp + dossiers cloud
C’est probablement le concurrent le plus répandu dans l’ICP. Avantages : coût marginal faible, flexibilité, habitudes existantes et contrôle local. Faiblesses : absence de source unique, conflits de versions, droits rudimentaires, photos non reliées au contrat, alertes manuelles et dépendance à une personne. La stratégie ne doit pas ridiculiser cet empilement : il faut proposer import, coexistence et gain concret sur un seul workflow.

### Outils de réservation généralistes
Ils apportent calendrier, formulaire web, paiement et parfois CRM, mais couvrent moins bien le véhicule, l’état contradictoire, le kilométrage, la maintenance, le conducteur et le dommage. ReservationKey illustre ce positionnement : son cœur public est la réservation, alors que les fonctions automobiles d’état des lieux et de maintenance ne sont pas démontrées [8].

### ERP/CRM généralistes
Odoo, Zoho, HubSpot ou un ERP local peuvent assembler CRM, facturation, stocks et automatisations. Leur force est l’extensibilité ; leur faiblesse pour une TPE est la conception du modèle métier, le paramétrage, les intégrations et la responsabilité de mise en œuvre. Odoo documente bien Rental et Fleet séparément, mais le parcours automobile intégré reste à configurer et tester [7].

### Agences web et développement sur mesure
Une agence peut connecter réservation, paiement, CRM et comptabilité, voire développer un portail. C’est pertinent pour un réseau ou un besoin différenciant, mais généralement trop lent, coûteux et dépendant du prestataire pour une flotte de 5–100 véhicules. Le sur-mesure est un substitut au logiciel produit, pas nécessairement un concurrent tarifaire direct.

## 6. Carte de positionnement

Sur un axe horizontal **simplicité/prix croissants** et un axe vertical **profondeur métier automobile croissante** :

- **Excel/WhatsApp** : très simple et peu coûteux au départ, profondeur très faible.
- **ReservationKey/Booqable** : simplicité élevée, profondeur automobile faible à moyenne ; bons pour réservation et paiement, moins probants sur dommages et maintenance [6][8].
- **TEORI/Fleetee** : zone la plus proche de l’ICP, avec simplicité/prix attractifs et profondeur métier déjà significative [1][2].
- **TopRentApp/RentSyst** : profondeur opérationnelle potentiellement élevée, mais distance de localisation/documentation française à réduire [3][4].
- **Renthub** : profondeur et omnicanal potentiellement élevés, mais prix et configuration plus complexes [5].
- **Odoo** : profondeur transverse élevée et flexibilité forte, simplicité de déploiement plus faible [7].
- **Produit envisagé** : ne doit pas viser “le plus riche”. Il doit viser **simplicité élevée + profondeur ciblée sur les moments à risque** : disponibilité fiable, état départ/retour, preuve dommage, maintenance bloquante, facture et intégrations françaises.

## 7. Recommandation produit, offre et mise sur le marché

### 7.1 Différenciation recommandée

**Promesse :** “Le dossier de chaque location, du véhicule disponible au retour facturé, sans Excel ni litige de photos.”

1. **Parcours retour-dommage probant** : photos guidées par zones, horodatage, comparaison départ/retour, signature, lien vers contrat, calcul de frais et génération de justificatif.
2. **Disponibilité opérationnelle, pas seulement réservationnelle** : états disponible, réservé, loué, nettoyage, maintenance, sinistre, quarantaine ; aucun véhicule bloqué ne doit apparaître louable.
3. **Maintenance pragmatique** : échéances calendrier/kilométrage, coûts, fournisseur, immobilisation, contrôle technique, pneus et alertes ; pas de module atelier disproportionné.
4. **Localisation France par défaut** : modèles contractuels, TVA, numérotation, export vers cabinets/comptabilités, Factur-X ou format à confirmer, RGPD, conservation et réversibilité documentées.
5. **Migration en une demi-journée** : import Excel standardisé, assistant de nettoyage, import clients/véhicules/réservations à venir ; export complet garanti.
6. **Mobile et faible connectivité** : états des lieux conçus pour un téléphone, avec reprise si réseau faible ; fonctionnalité hors ligne à confirmer comme investissement prioritaire après entretiens.
7. **Intégrations sobres** : paiement/caution via prestataires, comptabilité/export, API/webhooks documentés ; ne pas construire un channel manager avant preuve de demande.

### 7.2 Offre et pricing SaaS — hypothèses testables

Les concurrents français affichent déjà des niveaux d’environ 49–219 € HT/mois chez TEORI et 49–297 € HT/mois chez Fleetee selon modules/taille [1][2]. Le prix doit donc se justifier par l’onboarding, la preuve de dommage et la localisation, pas par la simple existence d’un planning.

**Hypothèse A — prix par flotte, lisible :**

- **Essentiel** : 59 € HT/mois jusqu’à 10 véhicules ; fiches, planning, contrats, clients, export.
- **Opérationnel** : 129 € HT/mois jusqu’à 30 véhicules ; états départ/retour, photos, dommages, alertes, facturation simple.
- **Pro** : 229 € HT/mois jusqu’à 100 véhicules ; maintenance, multi-agence légère, droits, reporting, API/export avancé.
- **Onboarding optionnel** : 250–750 € HT selon import et formation, à tester ; ne pas le rendre obligatoire au premier contact.

**Hypothèse B — abonnement + usage contrôlé :** forfait inférieur et facturation additionnelle par véhicule ou dossier d’état des lieux. À ne retenir que si les utilisateurs refusent un prix fixe et si la marge photo/stockage est mesurée.

**Hypothèse C — garantie de sortie :** essai 30 jours sur un cas réel, export complet disponible, pas d’engagement initial supérieur à un mois. Cela réduit la crainte de migration et force la qualité du produit.

**Critères de validation prix :** au moins 5 prospects acceptent un pilote payant ou une lettre d’intention à un niveau donné ; le temps de formation est inférieur à deux heures ; 80 % des états des lieux pilotes sont réalisés sans assistance ; la valeur perçue porte sur litiges/temps économisé et non uniquement sur le prix.

### 7.3 Stratégie de mise sur le marché Côte d’Azur

**Vague 1 — niche et preuve (0–30 jours)**

- Recruter 10–15 loueurs dans Nice, Cannes, Antibes, Grasse, Fréjus/Saint-Raphaël et Monaco limitrophe, avec équilibre entre généraliste, premium, utilitaire et saisonnier.
- Faire une démonstration sur leurs propres documents et un retour endommagé.
- Offrir une migration pilote limitée à 5–20 véhicules, avec mesure du temps administratif, erreurs, délais de facturation et litiges.

**Vague 2 — partenaires et références (31–60 jours)**

- Transformer 3–5 pilotes en références anonymisées ou publiques.
- Nouer des partenariats avec experts-comptables de TPE, garages, carrossiers, préparateurs, assureurs/courtiers, réseaux d’entrepreneurs, conciergeries et agences web locales.
- Approcher les offices/acteurs touristiques non comme distributeurs exclusifs, mais comme sources de légitimité et de visibilité.

**Vague 3 — répétabilité (61–90 jours)**

- Formaliser une offre “migration en 48 h” pour un jeu de données propre.
- Publier une page par segment et une comparaison transparente avec Excel, TEORI/Fleetee et ERP généraliste sans dénigrer les concurrents.
- Mettre en place prospection locale ciblée, appels sortants et démonstrations collectives ; tester ensuite SEO sur “logiciel location voiture”, “état des lieux location voiture” et “gestion flotte agence”.

### 7.4 Canaux partenaires

1. Experts-comptables et cabinets qui accompagnent des garages, agences et loueurs.
2. Garages, carrossiers, centres de contrôle technique et sociétés de préparation/nettoyage.
3. Courtiers en assurance et gestionnaires de sinistres.
4. Agences web/marketing touristique qui créent les sites de réservation.
5. Réseaux de franchisés, groupements de loueurs et associations professionnelles.
6. Conciergeries, hôtels et acteurs de mobilité pouvant recommander des indépendants.

Le programme partenaire doit rester simple : commission récurrente limitée, compte démo, kit d’import et support de premier niveau. Il faut éviter un réseau de revendeurs avant d’avoir stabilisé onboarding et support.

## 8. Plan de validation commerciale sur 90 jours

| Période | Actions | Seuil de décision |
|---|---|---|
| J1–J15 | 20 entretiens ; cartographier outils, volume, litiges, facturation, maintenance, déclencheurs et budget | Au moins 12/20 confirment un problème récurrent et 8 acceptent une démonstration |
| J16–J30 | Prototype ou maquette testée sur 5 cas : réservation, départ, retour sans dommage, retour avec dommage, maintenance | 4/5 utilisateurs réalisent le parcours principal sans aide majeure |
| J31–J45 | 5 pilotes gratuits ou à prix symbolique, import de données réelles, métriques avant/après | Données importées en moins d’une journée ; 80 % des dossiers pilotes complets |
| J46–J60 | Conversion de 3 pilotes en bêta payante ; test de 2–3 paliers de prix | Au moins 2 paiements ou lettres d’intention fermes ; objections prix qualifiées |
| J61–J75 | Ajouter export comptable, droits et alertes les plus demandés ; sécuriser 3 partenaires | 5 prospects qualifiés provenant de partenaires ; aucun blocage juridique critique |
| J76–J90 | Offre publique limitée Côte d’Azur ; 10 démonstrations qualifiées et 5 propositions | Go si 3–5 clients payants, activation <7 jours et support soutenable ; sinon repositionner ou arrêter |

**Métriques à instrumenter :** temps de création d’un dossier, temps d’état des lieux, taux de dossiers complets, délai de facturation après retour, nombre de litiges avec preuve exploitable, véhicules loués alors qu’indisponibles, alertes maintenance traitées, utilisateurs actifs hebdomadaires, coût d’acquisition par canal, churn et tickets par compte.

## 9. Risques et limites

- **Marché étroit localement** : la Côte d’Azur permet une prospection dense mais ne garantit pas un volume national suffisant ; valider la répétabilité dans deux autres régions.
- **Concurrence prix forte** : des offres françaises publient déjà des prix bas et une couverture large [1][2].
- **Commoditisation du planning** : le planning seul ne soutient ni différenciation ni prix.
- **Complexité cachée des contrats** : franchises, assurances, conducteurs, dépôts, amendes et moyens de paiement peuvent varier fortement.
- **Responsabilité probatoire** : une photo mal horodatée, non reliée au contrat ou modifiable peut réduire la valeur du produit ; il faut définir conservation, audit et export.
- **Conformité** : RGPD, facturation électronique, TVA, conservation, signature et paiements doivent être validés avec conseil juridique/comptable ; les pages concurrentes ne suffisent pas à conclure [1][2][3][4][5][6][7].
- **Saisonnalité** : les pilotes hors saison peuvent sous-estimer charge et valeur ; simuler les pics.
- **Support** : l’ICP sans DSI attendra souvent un support humain ; le coût peut devenir le principal poste hors développement.
- **Intégrations tierces** : caution, paiement, comptabilité et GPS ajoutent dépendances, frais et incidents ; lancer avec peu de connecteurs.
- **Biais de découverte** : les entreprises déjà satisfaites par Excel peuvent reconnaître le problème sans vouloir payer ; mesurer un engagement financier, pas seulement l’intérêt en entretien.
- **Données de marché** : la taille estimée ci-dessus est un scénario, à remplacer par un décompte SIRENE puis une qualification téléphonique.

## 10. Questions à poser en entretiens

1. Combien de véhicules possédez-vous, louez-vous ou gérez-vous aujourd’hui, et combien sont réellement disponibles en haute saison ?
2. Combien de réservations, départs et retours traitez-vous par semaine en basse et haute saison ?
3. Quels outils utilisez-vous pour planning, contrats, photos, paiements, factures, maintenance et comptabilité ?
4. Où se trouve aujourd’hui la “source de vérité” d’une réservation ? Que se passe-t-il en cas de conflit entre Excel, WhatsApp et le calendrier ?
5. Combien de temps prend un départ et un retour ? Quelles informations sont systématiquement oubliées ?
6. Combien de litiges de dommage avez-vous eus sur les 12 derniers mois ? Quelle preuve aviez-vous ? Quel montant était en jeu ?
7. Comment gérez-vous les cautions, retenues, remboursements, franchises, carburant et kilométrage ?
8. Comment savez-vous qu’un véhicule ne doit pas être loué pour entretien, nettoyage, sinistre ou contrôle ?
9. Quels documents et exports votre comptable demande-t-il ? Utilisez-vous Sage, Pennylane, EBP, Cegid, QuickBooks ou autre ?
10. Combien d’utilisateurs et d’agences doivent travailler simultanément ? Quelles permissions sont nécessaires ?
11. Quelle intégration vous ferait gagner le plus de temps : paiement, caution, comptabilité, réservation web, GPS, signature ou messagerie ?
12. Qu’est-ce qui vous a fait choisir ou abandonner votre logiciel actuel ?
13. Quel budget mensuel et quel coût d’installation seraient acceptables si le produit supprimait une journée administrative par semaine ou réduisait les litiges ?
14. Accepteriez-vous un pilote sur 10 véhicules avec vos données réelles ? À quelles conditions paieriez-vous après 30 jours ?
15. Qu’est-ce qui vous ferait arrêter le produit immédiatement : perte de données, absence de support, lenteur, conformité, prix, export ou dépendance fournisseur ?

## 11. Conclusion go/no-go

**Go conditionnel pour une validation commerciale, pas encore go pour un développement complet.** Le besoin est suffisamment concret et la Côte d’Azur offre un terrain pertinent : forte saisonnalité, clientèle internationale, petits opérateurs et cas de dommages/rotation visibles. Toutefois, la concurrence directe est déjà robuste et peu chère, en particulier TEORI et Fleetee [1][2].

Le projet doit passer un test de 90 jours avec un produit étroit : import, disponibilité, contrats, état départ/retour probant, dommages, maintenance bloquante, facturation simple et export. Il faut obtenir des paiements ou engagements, pas uniquement des retours positifs. **Go produit** si 3–5 premiers clients paient, si l’activation est inférieure à une semaine, si le parcours de retour est utilisé et si la marge de support est soutenable. **Pivot** si les clients demandent surtout un moteur de réservation ou un ERP comptable complet : dans ce cas, intégrer un existant ou se spécialiser davantage. **No-go** si les prospects ne perçoivent pas de valeur supérieure aux solutions françaises existantes ou refusent de payer après pilote.

## References

[1]: https://teori.fr/ "TEORI — Logiciel de gestion de location de véhicules"
[2]: https://www.fleetee.io/ "Fleetee — Logiciel de gestion pour loueurs de véhicules"
[3]: https://toprentapp.com/fr "TopRentApp — Logiciel de location de voiture"
[4]: https://rentsyst.com/ "RentSyst — Car Rental Software"
[5]: https://www.renthubsoftware.com/fr/logiciel-de-gestion-cloud-pour-la-location-de-voitures/ "Renthub — Logiciel de gestion cloud pour la location de voitures"
[6]: https://booqable.com/industries/car-rental-software/ "Booqable — Car Rental Software"
[7]: https://www.odoo.com/app/rental "Odoo Rental — Rental Management Software"
[8]: https://www.reservationkey.com/reservation-software/vehicle-rental "ReservationKey — Vehicle Rental Reservation Software"
