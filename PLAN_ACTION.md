# Ockham CRM — plan d'action

> Version du 04/10/2026. Remplace l'ordre de la section 12.4 du CDC.

## Le principe

On **temporise sur les vraies données** : 4 888 fiches, c'est trop pour juger d'un écran. On construit une **maquette qui fonctionne** sur une **base fictive de 10 clients**. Chaque module se clique, s'ouvre et se paramètre. Quand l'ergonomie et la charte sont validées, on rebranche les données d'Elise Lyon.

**Chaque module suit le même circuit :**
1. Je développe sur une branche.
2. Je vérifie : construction de l'application, contrôle de code, test d'isolation.
3. Vous validez à l'œil sur la prévisualisation.
4. Je mets en ligne.

**Hors périmètre pour l'instant :**
- la recherche de prospects dans les bases publiques ;
- les appels d'offres et la veille ;
- les campagnes ;
- la reprise de l'historique du Google Sheet ;
- les devis.

## Phase 0 — Remise à plat (taille S)

| Livrable | Détail |
|---|---|
| **Organisation « Démo »** | Une organisation séparée, avec des données fictives cohérentes : 10 clients (payeurs et clients directs), environ 25 points de collecte, 3 commerciaux fictifs plus vous, des contacts, des factures mensuelles sur 24 mois pour que les graphiques aient de la matière, et une quinzaine de prospects répartis sur les étapes |
| **Script rejouable** | `supabase/seed/demo.sql` : remet la démo à zéro en une commande, avant chaque présentation |
| **Bascule de votre compte** | Votre compte passe sur l'organisation Démo. Les données Elise Lyon restent en base, intactes mais invisibles. On les supprimera ou on les rebranchera plus tard |
| **Comptes clients** | La branche actuelle est revue sur la démo, puis mise en ligne |

## Phase 1 — Charte et socle d'interface (taille M)

Avant de multiplier les écrans, on fixe la grammaire visuelle.

| Livrable | Détail |
|---|---|
| **Page « Charte »** (visible par l'admin) | Toutes les briques sur une seule page : couleurs et dégradés, typographie, boutons, badges, tableaux, filtres, fiches, onglets, panneau latéral, fenêtre de confirmation, messages, états vides et de chargement. Vous validez ou corrigez à un seul endroit, et tout l'outil suit |
| **Couleurs des statuts** | Une palette unique pour les types de compte, les étapes du pipeline, la chaleur, les alertes. Lisible, sans surcharge |
| **Composants communs** | Tableau filtrable, fiche à onglets, panneau latéral d'édition, sélecteurs : écrits une fois, réutilisés partout |
| **Navigation** | Barre latérale définitive, fil d'Ariane, page Paramètres structurée en sections |

## Phase 2 — Module Prospection : le pipeline des leads (taille L, priorité)

### 2a. Paramètres du pipeline
- **Étapes** : créer, renommer, réordonner, colorer, donner une probabilité par défaut et un type (en cours, gagné, perdu), désactiver.
- **Champs personnalisés** : créer un champ (texte court ou long, nombre, montant, date, liste, choix multiple, case à cocher, téléphone, email), le ranger dans une section, le rendre obligatoire, ajouter une aide, saisir son nom dans Elise Pro / Axonaut.
- **Valeurs de liste** : ajouter, renommer, réordonner, désactiver.
- **Les 3 garde-fous validés** :
  - on désactive, on ne supprime jamais ;
  - les valeurs sont enregistrées par identifiant ;
  - les admins et managers créent les champs, les commerciaux ajoutent des valeurs seulement si le champ l'autorise.
- **Champs de départ** : les ~10 champs du Google Sheet (origine, type de contrat, secteur, effectif, zone, chaleur, pourquoi Elise, décideur, visite, CITEO, Marguerite, sous-traitance).

### 2b. Fiche prospect
- Création rapide : nom, commercial, étape, montant. Le reste se complète ensuite.
- Le socle fixe, plus les champs personnalisés affichés par section, dans l'ordre réglé.
- Contacts du prospect, journal d'activité (commentaire, appel, RDV, email), date de relance.
- Montant saisi en mensuel ou en annuel, budget initial, probabilité (proposée par l'étape, modifiable).

### 2c. Pipeline
- **Vue en colonnes** (glisser-déposer d'une étape à l'autre) et **vue liste**.
- Filtres : « Mes leads », commercial, chaleur, origine, et n'importe quel champ personnalisé de type liste.
- En tête : nombre, montant total, montant pondéré par étape.
- Passage en **perdu** : motif obligatoire, date de relance proposée.
- Passage en **gagné** : fiche de passation (tous les champs avec leur nom Elise Pro / Axonaut, prêts à copier), saisie du code Elise Pro.

### 2d. Archivage et rattachement
- Un prospect gagné est rattaché à un compte client : choisi à la main dans la démo, proposé automatiquement par le code Elise Pro quand la synchro Axonaut sera branchée.
- La fiche est alors archivée et apparaît dans **« Historique de prospection »** sur la fiche client.
- Un filtre « Archivés » dans le pipeline.

## Phase 3 — Module Clients (taille M)

- Finition de la liste et de la fiche (déjà développées sur la branche).
- Historique de prospection sur la fiche client.
- **Mouvements de CA** : hausse, baisse, résiliation, en mensuel, avec date d'effet et motif. Les déclencheurs, types de variation et motifs de résiliation sont des listes réglables, gérées par le même moteur que les champs personnalisés.
- Rattachements point de collecte → payeur (déjà développés).

## Phase 4 — Tableau de bord (taille M)

Reprise des trois blocs du Google Sheet, calculés automatiquement, par mois et par commercial :
- **A. Acquisition** :
  - opportunités par origine et par motivation ;
  - pipeline actif ;
  - signatures, taux de transformation et panier moyen ;
  - cycle de vente.
- **B. Up-sales** : hausses, baisses, déclencheurs, types.
- **C. Résiliations** : nombre, montant, motifs.
- **Balance** : nouveaux + hausses − baisses − résiliations.

## Phase 5 — Agenda et RDV (taille M)

- RDV depuis une fiche prospect ou client, avec compte rendu et prochaine action.
- Connexion Google (connexion avec Google + Agenda), rappels par email (Resend).

## Phase 6 — Carte (taille S à M)

- Calques clients, points de collecte et prospects, coloriés par commercial ou par CA, pour repérer les zones faibles.
- Géocodage des adresses (API Adresse).

## Phase 7 — Passage aux vraies données (taille M)

- Clé API Axonaut : synchro des sociétés, des champs personnalisés et des factures mois par mois.
- Rattachement automatique prospect → client par le code Elise Pro.
- Reprise de l'historique du Google Sheet (454 opportunités, 203 variations, 101 résiliations).
- Création des comptes des commerciaux, pilote avec 2 ou 3 d'entre eux.

## Ensuite

Recherche de prospects (bases publiques et score), campagnes, appels d'offres et veille, encours Lettrage, Gmail, organisation de démonstration pour d'autres clients d'Ockham.
