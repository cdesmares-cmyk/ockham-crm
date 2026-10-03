-- ============================================================================
-- Ockham CRM — migration 001 : socle V1
--
-- Organisations, utilisateurs, entreprises (SIREN), tiers (fiches Axonaut),
-- contacts, factures, journal des synchros.
--
-- Principe de sécurité : chaque table porte organisation_id, et le RLS (règle
-- en base qui filtre ligne par ligne) ne laisse voir que l'organisation de
-- l'utilisateur connecté. Un compte sans ligne dans `utilisateurs` ne voit rien.
--
-- Écritures : les données Axonaut (entreprises, tiers, factures) sont écrites
-- par les Edge Functions de synchro, avec la clé service_role qui ne passe pas
-- par le RLS. Depuis le navigateur, on ne peut modifier que ce qui relève du
-- travail commercial (rattachement, consignes, contacts).
-- ============================================================================

create extension if not exists pg_trgm with schema extensions;

-- ----------------------------------------------------------------------------
-- Horodatage automatique de updated_at
-- ----------------------------------------------------------------------------
create or replace function public.maj_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- organisations : un client d'Ockham CRM (ex. Elise Lyon)
-- ----------------------------------------------------------------------------
create table public.organisations (
  id          uuid primary key default gen_random_uuid(),
  nom         text not null,
  code_org    text unique,
  siren       char(9),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- utilisateurs : les « opérateurs » du CRM, rattachés à un compte de connexion
-- ----------------------------------------------------------------------------
create table public.utilisateurs (
  id               uuid primary key references auth.users (id) on delete cascade,
  organisation_id  uuid not null references public.organisations (id) on delete restrict,
  role             text not null default 'commercial'
                   check (role in ('superadmin', 'admin', 'manager', 'commercial')),
  prenom           text,
  nom              text,
  email            text not null,
  -- Email tel qu'il apparaît dans « Commercial responsable » d'Axonaut,
  -- pour relier les fiches au bon commercial pendant la synchro.
  email_axonaut    text,
  manager_id       uuid references public.utilisateurs (id) on delete set null,
  codes_postaux    text[] not null default '{}',
  actif            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index utilisateurs_organisation_idx on public.utilisateurs (organisation_id);
create unique index utilisateurs_email_axonaut_uniq
  on public.utilisateurs (organisation_id, lower(email_axonaut))
  where email_axonaut is not null;

-- ----------------------------------------------------------------------------
-- Fonctions d'aide RLS (mêmes noms que dans Lettrage)
--
-- SECURITY DEFINER : elles lisent `utilisateurs` sans repasser par son propre
-- RLS, ce qui évite une boucle infinie. search_path vide : aucun objet ne peut
-- être substitué par un schéma piégé.
-- ----------------------------------------------------------------------------
create or replace function public.get_my_organisation_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select organisation_id
  from public.utilisateurs
  where id = auth.uid() and actif
$$;

create or replace function public.get_my_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.utilisateurs
  where id = auth.uid() and actif
$$;

create or replace function public.is_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select role = 'superadmin' from public.utilisateurs where id = auth.uid() and actif),
    false
  )
$$;

revoke execute on function public.get_my_organisation_id() from public, anon;
revoke execute on function public.get_my_role()            from public, anon;
revoke execute on function public.is_superadmin()          from public, anon;
grant  execute on function public.get_my_organisation_id() to authenticated;
grant  execute on function public.get_my_role()            to authenticated;
grant  execute on function public.is_superadmin()          to authenticated;

-- ----------------------------------------------------------------------------
-- entreprises : niveau SIREN, données légales (API Recherche d'entreprises)
-- Une copie par organisation : plus simple à isoler qu'un référentiel partagé.
-- ----------------------------------------------------------------------------
create table public.entreprises (
  id                uuid primary key default gen_random_uuid(),
  organisation_id   uuid not null references public.organisations (id) on delete cascade,
  siren             char(9) not null check (siren ~ '^[0-9]{9}$'),
  raison_sociale    text,
  naf               text,
  libelle_naf       text,
  tranche_effectif  text,
  categorie         text,             -- PME, ETI, GE
  date_creation     date,
  etat              text check (etat in ('A', 'C')),   -- A = active, C = cessée
  enrichi_le        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (organisation_id, siren)
);

create index entreprises_naf_idx on public.entreprises (organisation_id, naf);

-- ----------------------------------------------------------------------------
-- tiers : une fiche société Axonaut (niveau SIRET)
-- Peut être payeur, point de collecte, ou les deux.
-- ----------------------------------------------------------------------------
create table public.tiers (
  id                    uuid primary key default gen_random_uuid(),
  organisation_id       uuid not null references public.organisations (id) on delete cascade,
  axonaut_id            bigint not null,
  entreprise_id         uuid references public.entreprises (id) on delete set null,
  siret                 char(14) check (siret ~ '^[0-9]{14}$'),
  -- Statut de contrôle du SIRET de la fiche : valide, vide, factice (111…),
  -- cle_invalide (échoue au contrôle de Luhn).
  siret_statut          text check (siret_statut in ('valide', 'vide', 'factice', 'cle_invalide')),
  nom                   text not null,
  adresse               text,
  code_postal           text,
  ville                 text,
  pays                  text,
  latitude              double precision,
  longitude             double precision,
  est_payeur            boolean not null default false,
  est_point_collecte    boolean not null default false,

  -- Rattachement point de collecte → payeur (qualifié dans le CRM)
  payeur_id             uuid references public.tiers (id) on delete set null,
  rattachement_statut   text check (rattachement_statut in ('suggere', 'valide', 'rejete')),
  rattachement_par      uuid references public.utilisateurs (id) on delete set null,
  rattachement_le       timestamptz,

  commercial_id         uuid references public.utilisateurs (id) on delete set null,
  commercial_axonaut    text,          -- email brut d'Axonaut, avant rapprochement
  actif                 boolean,
  -- Champs personnalisés Axonaut (Zone, Catégorisation, Mode de collecte…),
  -- gardés tels quels pour ne rien perdre.
  champs_axonaut        jsonb not null default '{}',
  consignes             text,          -- accès, badge, code, consignes de collecte
  ca_total              numeric(14, 2) not null default 0,
  ca_annee              numeric(14, 2) not null default 0,
  premiere_facture      date,
  derniere_facture      date,
  doublon_de            uuid references public.tiers (id) on delete set null,
  synchro_le            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique (organisation_id, axonaut_id),
  check (payeur_id is null or payeur_id <> id)
);

create index tiers_entreprise_idx  on public.tiers (entreprise_id);
create index tiers_payeur_idx      on public.tiers (payeur_id);
create index tiers_commercial_idx  on public.tiers (organisation_id, commercial_id);
create index tiers_cp_idx          on public.tiers (organisation_id, code_postal);
create index tiers_siret_idx       on public.tiers (organisation_id, siret);
create index tiers_nom_trgm_idx    on public.tiers using gin (nom extensions.gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- contacts
-- ----------------------------------------------------------------------------
create table public.contacts (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  tiers_id         uuid not null references public.tiers (id) on delete cascade,
  axonaut_id       bigint,
  prenom           text,
  nom              text,
  fonction         text,
  email            text,
  telephone        text,
  mobile           text,
  -- RGPD : la personne s'oppose à recevoir de la prospection ou des campagnes
  opposition       boolean not null default false,
  opposition_le    timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index contacts_tiers_idx on public.contacts (tiers_id);
create unique index contacts_axonaut_uniq
  on public.contacts (organisation_id, axonaut_id)
  where axonaut_id is not null;

-- ----------------------------------------------------------------------------
-- factures (Axonaut)
-- ----------------------------------------------------------------------------
create table public.factures (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  axonaut_id       bigint not null,
  tiers_id         uuid references public.tiers (id) on delete set null,
  numero           text,
  date_facture     date not null,
  montant_ht       numeric(14, 2) not null default 0,
  montant_ttc      numeric(14, 2),
  statut           text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organisation_id, axonaut_id)
);

create index factures_tiers_date_idx on public.factures (tiers_id, date_facture);
create index factures_org_date_idx   on public.factures (organisation_id, date_facture);

-- ----------------------------------------------------------------------------
-- sync_runs : journal des synchronisations
-- ----------------------------------------------------------------------------
create table public.sync_runs (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations (id) on delete cascade,
  source           text not null check (source in ('axonaut', 'sirene', 'lettrage', 'google', 'import_csv')),
  debut            timestamptz not null default now(),
  fin              timestamptz,
  statut           text not null default 'en_cours' check (statut in ('en_cours', 'ok', 'erreur')),
  lignes_lues      integer not null default 0,
  lignes_ecrites   integer not null default 0,
  erreur           text
);

create index sync_runs_org_idx on public.sync_runs (organisation_id, debut desc);

-- ----------------------------------------------------------------------------
-- Triggers updated_at
-- ----------------------------------------------------------------------------
create trigger organisations_updated_at before update on public.organisations for each row execute function public.maj_updated_at();
create trigger utilisateurs_updated_at  before update on public.utilisateurs  for each row execute function public.maj_updated_at();
create trigger entreprises_updated_at   before update on public.entreprises   for each row execute function public.maj_updated_at();
create trigger tiers_updated_at         before update on public.tiers         for each row execute function public.maj_updated_at();
create trigger contacts_updated_at      before update on public.contacts      for each row execute function public.maj_updated_at();
create trigger factures_updated_at      before update on public.factures      for each row execute function public.maj_updated_at();

-- ----------------------------------------------------------------------------
-- Un rattachement doit rester dans la même organisation.
-- Le RLS contrôle la ligne modifiée, pas la ligne pointée par payeur_id :
-- sans ce garde-fou, un id d'une autre organisation pourrait être saisi.
-- ----------------------------------------------------------------------------
create or replace function public.verifier_rattachement_meme_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.payeur_id is not null and not exists (
    select 1 from public.tiers p
    where p.id = new.payeur_id and p.organisation_id = new.organisation_id
  ) then
    raise exception 'Le payeur doit appartenir à la même organisation';
  end if;
  if new.commercial_id is not null and not exists (
    select 1 from public.utilisateurs u
    where u.id = new.commercial_id and u.organisation_id = new.organisation_id
  ) then
    raise exception 'Le commercial doit appartenir à la même organisation';
  end if;
  return new;
end;
$$;

create trigger tiers_rattachement_meme_org
  before insert or update of payeur_id, commercial_id, organisation_id on public.tiers
  for each row execute function public.verifier_rattachement_meme_org();

create or replace function public.verifier_contact_meme_org()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.tiers t
    where t.id = new.tiers_id and t.organisation_id = new.organisation_id
  ) then
    raise exception 'Le contact doit être rattaché à une fiche de la même organisation';
  end if;
  return new;
end;
$$;

create trigger contacts_meme_org
  before insert or update of tiers_id, organisation_id on public.contacts
  for each row execute function public.verifier_contact_meme_org();

-- ----------------------------------------------------------------------------
-- RLS
-- Toutes les tables : RLS activé, aucun accès pour `anon` (visiteur non connecté).
-- Jamais de USING (auth.uid() is not null) : c'est la faille de Lettrage (mig. 162).
-- ----------------------------------------------------------------------------
alter table public.organisations enable row level security;
alter table public.utilisateurs  enable row level security;
alter table public.entreprises   enable row level security;
alter table public.tiers         enable row level security;
alter table public.contacts      enable row level security;
alter table public.factures      enable row level security;
alter table public.sync_runs     enable row level security;

revoke all on public.organisations, public.utilisateurs, public.entreprises,
              public.tiers, public.contacts, public.factures, public.sync_runs
  from anon;

-- organisations : lecture de la sienne ; modification par son admin.
create policy organisations_lecture on public.organisations
  for select to authenticated
  using (id = public.get_my_organisation_id());

create policy organisations_admin on public.organisations
  for update to authenticated
  using      (id = public.get_my_organisation_id() and public.get_my_role() = 'admin')
  with check (id = public.get_my_organisation_id() and public.get_my_role() = 'admin');

-- utilisateurs : lecture des collègues. Aucune écriture depuis le navigateur :
-- sinon un commercial pourrait se donner le rôle admin. La gestion de l'équipe
-- passera par une Edge Function qui contrôle les droits (comme admin-users).
create policy utilisateurs_lecture on public.utilisateurs
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

-- entreprises, factures, sync_runs : lecture seule (écrites par la synchro).
create policy entreprises_lecture on public.entreprises
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

create policy factures_lecture on public.factures
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

create policy sync_runs_lecture on public.sync_runs
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

-- tiers : lecture et modification (rattachement, consignes) dans son
-- organisation. Création et suppression réservées à la synchro.
create policy tiers_lecture on public.tiers
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

create policy tiers_modification on public.tiers
  for update to authenticated
  using      (organisation_id = public.get_my_organisation_id())
  with check (organisation_id = public.get_my_organisation_id());

-- Le RLS choisit les lignes, pas les colonnes. On limite donc les colonnes
-- modifiables depuis le navigateur au travail commercial : le CA, le SIRET,
-- l'identifiant Axonaut ou l'organisation ne peuvent pas être touchés.
revoke update on public.tiers from authenticated;
grant  update (payeur_id, rattachement_statut, rattachement_par, rattachement_le,
               consignes, doublon_de)
  on public.tiers to authenticated;

-- contacts : lecture, ajout, modification dans son organisation ; suppression
-- réservée aux admins et managers.
create policy contacts_lecture on public.contacts
  for select to authenticated
  using (organisation_id = public.get_my_organisation_id());

create policy contacts_ajout on public.contacts
  for insert to authenticated
  with check (organisation_id = public.get_my_organisation_id());

create policy contacts_modification on public.contacts
  for update to authenticated
  using      (organisation_id = public.get_my_organisation_id())
  with check (organisation_id = public.get_my_organisation_id());

create policy contacts_suppression on public.contacts
  for delete to authenticated
  using (organisation_id = public.get_my_organisation_id()
         and public.get_my_role() in ('admin', 'manager'));
