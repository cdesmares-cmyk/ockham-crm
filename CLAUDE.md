# OCKHAM CRM — contexte de travail

Fichier lu à chaque session. Il s'incrémente : toute règle fixée ou piège découvert
s'y ajoute. Le besoin fonctionnel est dans `CDC.md`.

## Le projet

CRM commercial de la famille Ockham. Premier client : **Elise Lyon** (collecte de
déchets d'entreprise), données issues d'**Axonaut**. Clément Desmares le développe
seul. Le produit sera **vendu à d'autres entreprises** : tout est multi-organisations
dès le départ.

| | Ockham CRM | Ockham Lettrage (référence) |
|---|---|---|
| Dossier | `Desktop/elise-crm` | `Desktop/1 - Ockham/Projet Dév Lettrage/lettrage-elise` |
| Supabase | `zekrqbdstpebyalhcsqd` (Ockham CRM) | `aqxsqmgtmenjpfrblqoe` |
| GitHub | à créer : `cdesmares-cmyk/ockham-crm` | `cdesmares-cmyk/lettrage-elise` |

## ⛔ Ockham Lettrage : lecture seule absolue

Lettrage est en production chez un client payant. Depuis ce projet, on **lit et on
copie** son code (charte, composants, Edge Functions) : jamais aucune écriture dans
son dossier, aucune commande git, `supabase link`, migration ou déploiement sur son
dépôt ou sa base. Exigé par écrit le 2026-10-03.

## Règles de collaboration (reprises de Lettrage)

**Aucune modification sans validation écrite.** Lire, auditer, proposer : libre.
Modifier un fichier, commiter, pousser, déployer, écrire en base : jamais sans un
accord écrit explicite. Un accord porte sur l'action décrite, pas sur les suivantes.

**Build de contrôle avant tout push.** `npm run build` est ce que Vercel exécute.
S'il échoue, on ne pousse pas. Ne jamais annoncer « testé » sans l'avoir exécuté.

**Une définition d'une ligne à chaque terme technique ou anglais**, la première fois.

**Ce qui demande ses yeux** : tout ce qui est visuel ou interactif. Le dire plutôt
que supposer.

## Ton

Phrases courtes, verbes simples, pas de tics d'IA (doubles tirets bas, tirets
cadratins en rafale, « il est important de noter que », triplets rhétoriques). Les
textes de l'application parlent à un directeur commercial : concrets, sobres, chiffrés.

## Grille de risque

Critère : **« si c'est faux, qu'est-ce qui casse, et puis-je revenir en arrière ? »**

🟢 **Vert, push direct** : CSS, libellés, icônes, docs. Le build passe.
🟠 **Orange, branche + preview validée à l'œil** : nouvel écran, navigation, calcul affiché.
🔴 **Rouge, jamais sans base de test** : tout ce qui écrit (synchros, migrations,
règles RLS, Edge Functions), et tout email qui peut partir chez un client ou un prospect.

## Stack

React 19 · Vite 8 · TypeScript · Tailwind 4 · Supabase · React Router 7. Même choix
que Lettrage pour reprendre sa charte (`src/index.css`, tokens `ockham-*`) et ses
composants.

```bash
npm run dev      # serveur local, http://localhost:5173
npm run build    # LA barrière avant tout push
npm run lint     # informatif
```

Sans `.env.local` rempli, `npm run dev` ouvre un **mode aperçu** (bouton sur la page
de connexion, visible seulement en local) pour voir les écrans sans base.

## Base de données

- Chaque table porte `organisation_id`. Policy canonique :
  `USING (organisation_id = get_my_organisation_id()) WITH CHECK (même chose)`.
  Jamais `USING (auth.uid() IS NOT NULL)` : c'est la faille corrigée dans Lettrage
  (migration 162).
- **Toute évolution passe par un fichier dans `supabase/migrations/`, appliqué par
  Claude via la CLI** (`npx supabase db push --linked`, après `--dry-run`), après
  accord écrit sur le fichier (décidé le 2026-10-03). Rien à la main dans l'éditeur
  SQL : c'est ce qui a créé la dérive de schéma de Lettrage. Si ça arrive quand même :
  `npx supabase migration repair --status applied <version> --linked`.
- **Test d'isolation** à rejouer après chaque migration :
  `npx supabase db query --linked -f supabase/tests/test_isolation_organisations.sql`
  (transaction annulée, chaque ligne doit afficher ok = true). Puis
  `npx supabase db advisors --linked` : seuls les 3 avertissements sur
  `get_my_organisation_id`, `get_my_role`, `is_superadmin` sont attendus.
- Sécurité vérifiée **par le test** (compte d'une organisation vide qui tente de lire
  une autre organisation, on compte les lignes), jamais par la seule lecture du SQL.

## Secrets

- `.env.local` (jamais commité) : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.
  Publiques par conception : la protection, c'est le RLS.
- Clés Axonaut, Resend, Google (secret) : **secrets Supabase** des Edge Functions,
  jamais dans le front.
- Exports de données (`data/`, `*.csv`) : jamais dans Git.

## État au 2026-10-03

Fait :
- CDC v0.2, squelette de l'application en ligne sur `ockham-crm.vercel.app`
  (projet Vercel `ockham-crm`, dépôt `cdesmares-cmyk/ockham-crm`).
- Base : migrations 001 (socle V1 + RLS) et 002 appliquées, registre à jour,
  test d'isolation 16/16. Base vide de données.
- Script d'import CSV Axonaut (`scripts/import-axonaut-csv.js`) : aperçu seul pour
  l'instant ; le SQL qu'il génère va dans `data/` (jamais commité).

Décidé : tout le monde voit 100 % du portefeuille, avec filtres « Mon portefeuille »
et « Mes leads ».

Ouvert : signification des fiches « Facturé à » (payeur pur ou aussi site
collecté ?), import réel, comptes utilisateurs, connexion Google, clé API Axonaut.
