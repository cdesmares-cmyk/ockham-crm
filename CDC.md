# Cahier des charges : Ockham CRM

> Version 0.2, 3 octobre 2026. Document de travail versionné avec le code.
> Premier client : Elise Lyon (collecte et recyclage des déchets de bureau et d'entreprise).

## 1. Objectif

Ockham CRM est l'outil commercial de la famille Ockham. Il reprend la charte, l'ergonomie et la technique d'**Ockham Lettrage**. Il est conçu pour être **vendu à d'autres entreprises** : chaque organisation ne voit que ses propres données.

Pour Elise Lyon (≈ 10 commerciaux, 15 utilisateurs à terme), il doit permettre de :

1. **Piloter la performance commerciale** depuis un tableau de bord.
2. **Comprendre et suivre le portefeuille** : qui paie, où l'on collecte, quel CA, par commercial, SIRET / SIREN, NAF et code postal.
3. **Accompagner les clients** : rendez-vous, rappels, relances commerciales, emails de suivi.
4. **Prospecter** : pipeline commercial, recherche d'entreprises, appels d'offres et veille.
5. **Communiquer** : listes de contacts qualifiées et campagnes d'emailing.

## 2. Périmètre

| Dans le projet | Hors projet pour l'instant |
|---|---|
| Tableau de bord, Comptes clients, Prospects, Agenda, Campagnes, Admin | **Devis et calculateur** (reste sur Excel, trop complexe à ce stade) |
| Lecture des données Axonaut, réécriture du lien point de collecte → payeur | Création de clients ou de devis dans Axonaut |
| Lecture de l'encours dans Ockham Lettrage | Toute modification d'Ockham Lettrage |

## 3. Technique

Même base qu'Ockham Lettrage, pour reprendre ses composants et sa charte (`DESIGN_SYSTEM.md` de Lettrage).

| Brique | Rôle |
|---|---|
| **React 19 + Vite + TypeScript** | L'application (React fabrique les écrans, Vite les assemble) |
| **Tailwind 4** | Les styles, avec les couleurs Ockham (teal `#4CC5BB`, navy `#0E1A2B`) et la police Plus Jakarta Sans |
| **Supabase** (projet *Ockham CRM*, `zekrqbdstpebyalhcsqd`) | Base Postgres, connexion des utilisateurs, règles d'accès, Edge Functions (petits programmes côté serveur pour les synchros et les envois) |
| **Vercel** | Hébergement, mise en ligne automatique à chaque envoi sur la branche `main` |
| **Resend** | Emails : invitations, rappels, relances, campagnes |
| **Google Workspace** | Connexion avec Google, Agenda, Gmail |

**Séparation des organisations.** Chaque table porte un `organisation_id`. La séparation repose sur le **RLS** (règle posée en base qui filtre ligne par ligne ce qu'un utilisateur peut lire), selon le même modèle que Lettrage :

```sql
CREATE POLICY "<table>_org_isolation" ON <table>
  FOR ALL
  USING      (organisation_id = get_my_organisation_id())
  WITH CHECK (organisation_id = get_my_organisation_id());
```

Elle est vérifiée **par un test réel** pour chaque nouvelle table : un compte d'une organisation vide tente de lire les données d'une autre. Une simple relecture du SQL ne suffit pas.

**Historique de la base.** Contrairement à Lettrage, chaque changement de structure passe par un fichier de migration dans `supabase/migrations/`, appliqué par la CLI Supabase. La base peut ainsi être reconstruite à l'identique, pour un test ou pour un nouveau client.

## 4. Constats sur les données (audit de l'export Axonaut du 03/10/2026)

| Indicateur | Valeur |
|---|---|
| Fiches « société » | **2 056** (toutes en statut client) |
| Fiches « Facturé à : … » (payeurs) | **1 256**, soit ~2,6 M€ de CA en 2026 |
| Autres fiches (sites ou clients directs) | 800, soit ~1,2 M€ de CA en 2026 ; 714 ont déjà été facturées |
| CA cumulé / CA 2026 | **11,6 M€ / 3,8 M€** |
| SIRET valides | 1 948 (1 810 distincts, **1 637 SIREN distincts**) |
| SIRET vides / factices (1111…) / clé invalide | 35 / 63 / 10 |
| Fiches dans le Rhône (69) | 1 478 (72 %), puis 38, 92, 75 |
| Commerciaux référencés | 9 principaux, 9 marginaux, 18 fiches sans commercial |
| Fiches marquées « do not use » | présentes (ex. GSF MERCURE), donc des doublons |
| Champs peu remplis | Secteur (≈ 28 %), Zone / Mode de collecte / Taille (≈ 30 %), Actif/Inactif (38 %), NAF absent |
| Contacts | 1 email par fiche (98 %), téléphone rare (27 % fixe, 4 % mobile) |

**Conséquences** :

- **Rien ne relie un point de collecte à son payeur.** Le lien sera qualifié dans Ockham CRM (voir 6.1).
- **Le CA est porté par la fiche facturée.** On l'affiche au niveau du payeur et on le consolide par entreprise (SIREN).
- **NAF, effectif officiel, date de création, état actif ou fermé** : ajoutés automatiquement via l'API Recherche d'entreprises.
- **Zone, Catégorisation, Mode de collecte, Type de contrat, BDC, Plateforme** sont des champs personnalisés Axonaut, récupérés via l'API.

## 5. Modèle de données

```
organisation (client Ockham CRM, ex. Elise Lyon)
 └── entreprise (SIREN)          ← données légales : NAF, effectif, état
       └── tiers (fiche Axonaut, SIRET)
             ├── est_payeur            (« Facturé à » ou client direct)
             ├── est_point_collecte    (lieu physique de collecte)
             └── payeur_id → tiers     (à qui on facture ce site)
```

- **Boulangerie** : un seul tiers, payeur et point de collecte à la fois.
- **Agence bancaire** : point de collecte rattaché au payeur « Facturé à : Société Générale ». Les deux appartiennent au même SIREN.

| Table | Contenu principal |
|---|---|
| `organisations` | client du CRM, paramètres, clés d'intégration (côté serveur uniquement) |
| `utilisateurs` | rôle, organisation, équipe, codes postaux attribués, connexion Google |
| `entreprises` | siren, raison sociale, NAF, effectif, catégorie, date de création, état |
| `tiers` | id Axonaut, siret, nom, adresse, coordonnées GPS, payeur / collecte, `payeur_id`, commercial, champs personnalisés Axonaut, consignes d'accès |
| `contacts` | tiers, nom, fonction, email, téléphone, opposition RGPD, consentement campagne |
| `factures` | id Axonaut, tiers payeur, date, montant HT |
| `rendez_vous` | tiers ou prospect, commercial, date, type, compte rendu, prochaine action, id Google Agenda |
| `taches` | rappels et relances : échéance, assigné, origine (manuelle ou règle automatique) |
| `regles_suivi` | règles automatiques (ex. « pas de RDV depuis 6 mois → tâche ») |
| `activites` | journal : appel, email, note, changement d'étape |
| `prospects` / `opportunites` | entreprise ciblée, source, score, étape du pipeline, montant, probabilité, date de signature prévue |
| `appels_offres` | source (BOAMP…), objet, acheteur, date limite, statut de suivi |
| `campagnes` / `envois` | audience, contenu, statistiques d'ouverture, de clic et de désinscription |
| `sync_runs` | journal des synchros (Axonaut, Sirene, Lettrage, Google) |

Toutes les tables portent `organisation_id`.

**Rôles** : `superadmin` (Ockham), `admin`, `manager`, `commercial`. **Tout le monde voit 100 % du portefeuille et des prospects de son organisation** (décidé le 03/10/2026). Chaque liste propose les filtres « Mon portefeuille » et « Mes leads ». Les rôles servent aux droits d'écriture : réglages, équipe, suppressions. Les rôles de Lettrage servent de modèle.

## 6. Intégrations

### 6.1 Axonaut
- Clé API par organisation, stockée côté serveur.
- Synchro chaque nuit + bouton « Resynchroniser » : sociétés, champs personnalisés, contacts, factures. Le code de la synchro Axonaut de Lettrage sert de modèle.
- **Lien point de collecte → payeur** : il est qualifié dans le CRM. L'outil suggère des rattachements (même SIREN, nom proche, même commercial) et le commercial valide. Le lien est ensuite réécrit dans un champ personnalisé Axonaut « Payeur ». L'écriture par l'API reste à confirmer ; à défaut, le lien ne vit que dans le CRM.

### 6.2 Google Workspace
- Connexion avec Google (et email + mot de passe pour les clients qui ne sont pas sur Google).
- **Agenda** : un RDV créé dans le CRM crée l'événement Google, et les événements liés à un client remontent dans le CRM.
- **Gmail** : envoi des emails de suivi depuis la boîte du commercial, historique des échanges sur la fiche client.
- Lettrage a déjà ce circuit (`gmail-oauth-callback`, `gmail-refresh-token`) : on le reprend.

### 6.3 Ockham Lettrage
- Affichage de l'encours, des retards et du niveau de relance sur la fiche payeur.
- Accès **en lecture seule** à la base de Lettrage, avec un rôle dédié. Aucune écriture.

### 6.4 Données entreprises, appels d'offres et veille
- **API Recherche d'entreprises** (gratuite, sans clé) : recherche par NAF, zone, effectif ; enrichissement des clients.
- **API Adresse** : coordonnées GPS des adresses Axonaut, pour la carte.
- **BOAMP** (API gratuite) : appels d'offres publics filtrés par mots-clés (collecte, déchets, tri, recyclage) et par zone, alerte quotidienne.
- **BODACC + Sirene** : signaux d'affaires dans la zone (créations, déménagements, nouveaux établissements). Lettrage a déjà une synchro BODACC.
- **Appels d'offres privés** : pas de source ouverte. Agrégateur payant, à décider plus tard.
- **Emails nominatifs des prospects** : service d'enrichissement conforme RGPD (ex. Dropcontact), en option.

### 6.5 Resend
- Emails système (invitations, rappels, récapitulatifs) et campagnes.
- **Campagnes envoyées depuis un sous-domaine dédié** (ex. `news.elise.com.fr`), pour protéger la réputation du domaine principal.

## 7. Écrans

### Tableau de bord
- CA du mois, de l'année et sur 12 mois glissants, comparé à l'année précédente, par commercial.
- Pipeline : montant total et pondéré par étape, opportunités à signer ce mois-ci.
- Activité : RDV réalisés et à venir, tâches en retard, clients sans contact depuis X mois.
- Alertes : clients en baisse, plus de facture depuis X jours, encours élevé dans Lettrage.

### Comptes clients
- Liste filtrable (commercial, payeur / point de collecte, NAF, code postal, zone, actif, CA) et **carte** des points de collecte.
- **Fiche client** : identité légale, payeur et sites rattachés, CA et tendance, factures, contacts, RDV, tâches, activité, encours Lettrage, consignes de collecte.
- Rattachement d'un point de collecte à son payeur, avec suggestions.
- Détection des doublons.

### Prospects
- **Pipeline** en colonnes : nouveau → qualifié → RDV → proposition → gagné / perdu. Montant, probabilité, date de signature prévue.
- **Recherche d'entreprises** : profil type calculé sur les meilleurs clients (NAF, taille, zone), recherche via l'API, exclusion des clients existants, **score sur 100 avec son détail**, ajout au pipeline en un clic, attribution par code postal.
- **Appels d'offres et veille** : flux BOAMP et signaux BODACC / Sirene filtrés, à qualifier ou écarter.

### Agenda
- Vue semaine / mois, synchronisée avec Google Agenda.
- Création rapide d'un RDV depuis une fiche, compte rendu structuré, prochaine action.
- Tâches et rappels, avec rappel par email la veille.

### Campagnes
- Audience construite par filtres (NAF, zone, type de client, commercial, CA…). Seuls les contacts sans opposition sont inclus.
- Modèle d'email, test, envoi, statistiques.
- Désinscription en un clic, enregistrée sur le contact.

### Admin
- Utilisateurs (« opérateurs »), rôles, équipes, codes postaux par commercial.
- Connexions : Axonaut, Google, Resend, Lettrage.
- Règles de suivi automatique, paramètres du score, journal des synchros.

## 8. Relances et suivi automatique

Des règles simples, réglables par l'admin, créent des tâches ou préparent des emails. Le commercial valide toujours l'envoi : aucun email ne part seul chez un client.

| Règle (exemples) | Effet |
|---|---|
| Pas de RDV depuis 6 mois | Tâche « reprendre contact » |
| CA sur 3 mois en baisse de plus de 30 % | Alerte + tâche |
| Plus de facture depuis 60 jours | Alerte « client perdu ? » |
| Prospect sans action depuis 15 jours | Rappel au commercial |
| Date anniversaire du contrat | Email de suivi préparé |

## 9. RGPD et sécurité
- Prospection B2B par email : autorisée sans consentement préalable si le message concerne la fonction de la personne. La source des données est indiquée, l'opposition est simple et enregistrée.
- Les prospects non convertis sont supprimés après 3 ans.
- Les clés API et les jetons Google restent côté serveur, jamais dans le navigateur.
- Aucun export de données dans Git (`data/` et `*.csv` sont exclus).

## 10. Plan de réalisation

| Version | Contenu | Statut |
|---|---|---|
| **V0** | Audit des données, cahier des charges, squelette de l'application avec la charte Ockham | En cours |
| **V1** | Organisations, utilisateurs et rôles, connexion, synchro Axonaut, Comptes clients + carte + fiche, Tableau de bord | |
| **V2** | Agenda + Google Agenda, tâches, règles de suivi, emails de suivi | |
| **V3** | Prospects : pipeline, recherche d'entreprises, score | |
| **V4** | Campagnes | |
| **V5** | Appels d'offres et veille | |
| **V6** | Encours Lettrage, Gmail, enrichissement des emails | |

Pilote avec 2 ou 3 commerciaux dès la V1.

## 11. Questions ouvertes
1. Signification des valeurs 1 à 4 des champs personnalisés « Zone » et « Catégorisation ».
2. Fichier des codes postaux par commercial.
3. ~~Visibilité~~ : 100 % du portefeuille pour tous, avec les filtres « Mon portefeuille » et « Mes leads ».
4. ~~Dépôt GitHub~~ : `cdesmares-cmyk/ockham-crm`.
5. Nom de domaine de l'application (ex. `crm.ockham-finance.com`).
6. Google Sheet actuel du canal de prospection : lien à transmettre, à étudier avant la V3.
7. Les commerciaux créent-ils encore des prospects dans Axonaut ? (voir 12.1, risque de doublons)
8. Le client créé par Elise Pro dans Axonaut est-il « client » dès sa création, ou seulement à la première facture ?

## 12. Les deux boucles métier (exprimées le 04/10/2026)

### 12.1 Boucle prospect : du premier contact au client facturé

```
 Ockham CRM                         Elise Pro (ERP)        Axonaut              Ockham CRM
 ───────────────────────────────    ───────────────        ───────              ──────────
 Nouveau prospect
   → fiche prospect
   → opportunité dans le pipeline
     (RDV, commentaires, contacts,
      montant, probabilité)
   → Perdu : arrêt (+ motif, date
     de relance éventuelle)
   → Signé ────────────────────────▶ création à la main ─▶ commande ──API──▶ client ──synchro──▶ nouveau compte client
                                                                                              │
   opportunité signée ◀──────────── rattachement prospect → client final ◀────────────────────┘
```

**Ce qu'on garde tel quel :** Elise Pro n'est pas connecté, la fiche est recréée à la main ; Axonaut reste la source des clients et du CA.

**Ce que je propose d'ajouter (challenge) :**

1. **Le code Elise Pro comme clé de rattachement.** L'analyse du Google Sheet (voir `docs/ANALYSE_SUIVI_COMMERCIAL.md`) montre que le code Elise Pro (N° Client / Code EP) se retrouve dans le champ « N° Client » d'Axonaut (95 à 100 % de correspondance). Saisi dans l'opportunité à la mise en place, il permet de **retrouver tout seul** le client quand il arrive par la synchro. Le **SIRET**, choisi dans la base publique des entreprises à la création du prospect, sert de clé de secours et à l'enrichissement (NAF, effectif).
2. ~~Une seule fiche par entreprise~~ — **décidé le 04/10/2026 : la fiche prospect reste distincte de la fiche client.** Elle vit dans le pipeline. Quand le client arrive d'Axonaut, on **rattache (ou non) la fiche prospect à la fiche client** : elle est alors archivée, consultable depuis le compte client (onglet « Historique de prospection »). Voir 12.5.
3. **Une étape « Signé, en attente de création »** entre la signature et l'apparition dans Axonaut. Elle se ferme d'elle-même quand le client est retrouvé. On mesure au passage le délai signature → première facture, et on repère les signatures oubliées dans Elise Pro.
4. **Une fiche de passation** à la signature : tout ce qu'il faut saisir dans Elise Pro (SIRET, adresses, contacts, flux, montant), prêt à copier. Moins de ressaisie, moins d'erreurs.
5. **« Perdu » ne veut pas dire « fini »** : motif de perte (prix, concurrent, pas de besoin, sans réponse) et date de relance proposée (6 ou 12 mois). Un prospect perdu est un prospect futur, et les motifs nourrissent les statistiques.
6. **Probabilité par défaut selon l'étape**, modifiable : nouveau 10 %, qualifié 25 %, RDV 40 %, proposition 60 %, négociation 80 %. Le pipeline pondéré (montant × probabilité) alimente le tableau de bord.
7. **Montant exprimé en mensuel** (récurrent), avec affichage annuel : c'est la même unité que les mouvements de CA (12.2), donc une affaire signée devient directement un mouvement « nouveau client ».

**Modèle de données envisagé :**

| Table | Contenu |
|---|---|
Remplacé par le modèle de la section 12.5.

### 12.2 Boucle client : suivre l'évolution du CA

Sur la fiche d'un compte, on saisit des **mouvements de CA** :

| Type | Exemple |
|---|---|
| Nouveau client | +450 €/mois au 01/11/2026 (créé automatiquement à partir d'une opportunité gagnée) |
| Augmentation | +120 €/mois au 01/01/2027 (nouveau flux, passage hebdo) |
| Réduction | −80 €/mois au 01/03/2027 |
| Résiliation | −(tout le récurrent) au 30/06/2027, avec motif |

Chaque mois, l'outil calcule le **CA récurrent** et le pont d'un mois sur l'autre :
`récurrent début + nouveaux + augmentations − réductions − résiliations = récurrent fin`, par commercial, secteur ou zone. C'est le tableau de bord dynamique demandé.

**Ce que je propose d'ajouter (challenge) :**

1. **Deux chiffres à ne pas confondre.** Le CA **facturé** vient d'Axonaut, c'est le réel. Le CA **récurrent** vient des mouvements, c'est le contractuel. L'écart entre les deux est une alerte utile : une baisse de facturation sans résiliation saisie, ou une augmentation saisie mais jamais facturée.
2. **Un point de départ.** Les mouvements partent d'une base : on initialise le récurrent de chaque client à partir de la moyenne de ses factures des 3 ou 12 derniers mois (à choisir), puis on valide. Il faut pour ça les **factures mois par mois**, donc la clé API Axonaut. L'export CSV ne donne que des totaux.
3. **Montants stockés en mensuel**, saisie possible en annuel (divisé par 12 à l'enregistrement) : un seul calcul, pas de mélange.
4. **Date d'effet obligatoire**, distincte de la date de saisie : une résiliation annoncée en juin pour fin septembre compte en septembre.
5. **Motif obligatoire sur les résiliations et réductions** : c'est la matière première de l'analyse du churn (taux de départ des clients).

**Table envisagée :** `mouvements_ca` (compte, opportunité d'origine éventuelle, type, montant mensuel signé, date d'effet, motif, commentaire, auteur, date de saisie), et une vue mensuelle qui en déduit le récurrent et le pont.

### 12.3 Carte

Une carte unique avec des calques activables : **clients, points de collecte, prospects, opportunités en cours**. Couleur par commercial, type ou CA. Objectif : voir les zones peu couvertes et prospecter autour des tournées existantes. Préalable : géocodage des adresses (API Adresse).

### 12.5 Fiche prospect et champs personnalisés (décidé le 04/10/2026)

**Principe.** Le pipeline se construit **de A à Z dans Ockham CRM**, sans rien coder en dur : les champs de qualification de la fiche prospect se créent, se modifient et se réordonnent depuis les **paramètres du pipeline**. Ils reprennent les champs personnalisés utilisés dans Elise Pro et Axonaut, pour que l'information circule avec les mêmes noms et les mêmes valeurs.

**Une fiche prospect = un socle fixe + des champs personnalisés.**

| Socle fixe (le moteur du pipeline) | Champs personnalisés (la qualification, réglable) |
|---|---|
| Nom de l'entreprise, SIRET (recherche dans la base publique), adresse | Origine du lead, type de contrat (Local / National / Cadre / AO), secteur, effectif, zone, mode de collecte, privé / public |
| Commercial en charge | Chaleur, pourquoi Elise, décideur, visite sur site |
| Étape du pipeline, statut (en cours / gagné / perdu / archivé) | CITEO, Marguerite, sous-traitance |
| Montant récurrent mensuel, budget initial, probabilité | … et tout ce que les équipes ajouteront |
| Dates : création, relance, signature, mise en place | |
| Contacts, activités (RDV, appels, commentaires) | |
| Code Elise Pro, client rattaché | |

Le socle reste fixe parce que le tableau de bord en dépend (montants, étapes, dates). Tout le reste est réglable.

**Types de champs :** texte court, texte long, nombre, montant (€), date, liste déroulante (un choix), choix multiple, case à cocher, téléphone, email.

**Réglages d'un champ :** libellé, type, valeurs de la liste (ajout, renommage, ordre, désactivation), obligatoire ou non, section de la fiche, ordre d'affichage, aide à la saisie, **nom du champ correspondant dans Elise Pro et Axonaut**.

**Garde-fous (challenge) :**
1. **Un champ ou une valeur ne se supprime pas, il se désactive.** Il disparaît des nouvelles saisies, mais les fiches anciennes gardent leur valeur et les statistiques restent justes.
2. **Les valeurs sont enregistrées par identifiant, pas par libellé.** Renommer « Local » en « Contrat local » ne casse ni les fiches ni les filtres.
3. **Qui modifie quoi.** Admin et manager créent et modifient les champs. Pour les commerciaux, une option par liste : « les commerciaux peuvent ajouter une valeur ». Sans ce garde-fou, on retrouve les listes divergentes du Google Sheet.
4. **La fiche de passation** à la signature affiche chaque champ avec son nom Elise Pro / Axonaut, prêt à recopier, tant qu'Elise Pro n'est pas connecté.
5. **Les étapes du pipeline sont aussi réglables** : nom, ordre, couleur, probabilité par défaut, et type (en cours, gagné, perdu). Départ avec les étapes actuelles du Sheet.

**Rattachement prospect → client.**
- La fiche prospect gagnée attend son client. Quand il arrive par la synchro Axonaut, l'outil le propose (code Elise Pro, puis SIRET, puis nom).
- Sur la **fiche client**, une section **« Historique de prospection »** : rattacher une ou plusieurs fiches prospect (un client peut en avoir plusieurs, ex. plusieurs sites signés), ou les détacher. Un clic ouvre la fiche prospect, en lecture, avec tout son historique.
- Une fois rattachée, la fiche prospect est **archivée** : elle sort du pipeline actif, reste trouvable avec le filtre « Archivés ».

**Modèle de données :**

| Table | Contenu |
|---|---|
| `pipeline_etapes` | organisation, libellé, ordre, couleur, probabilité par défaut, type (`en_cours`, `gagne`, `perdu`), active |
| `champs_perso` | organisation, objet (`prospect` aujourd'hui, `client` plus tard), clé stable, libellé, type, obligatoire, section, ordre, aide, correspondance Elise Pro / Axonaut, ajout de valeurs par les commerciaux autorisé, actif |
| `champs_perso_options` | champ, identifiant stable, libellé, ordre, actif |
| `prospects` | socle fixe ci-dessus + `valeurs_perso` (JSON : identifiant du champ → valeur ou identifiant(s) d'option) + `client_tiers_id`, statut du rattachement, archivé le |
| `prospect_contacts`, `activites`, `rendez_vous` | contacts propres au prospect, journal, RDV |

**Reprise de l'existant :** les ~10 champs du Google Sheet sont créés comme premiers champs personnalisés, avec leurs valeurs actuelles ; les 454 opportunités du Sheet peuvent être importées comme fiches prospect (les 167 signées archivées et rattachées à leur client par le code Elise Pro).

### 12.4 Ordre proposé

1. Mise en ligne de Comptes clients (fait, en validation).
2. Clé API Axonaut : synchro des factures mois par mois → base du CA récurrent.
3. Carte (géocodage + calques).
4. Pipeline prospect (12.1), après étude du Google Sheet actuel.
5. Mouvements de CA et tableau de bord dynamique (12.2).
