-- ============================================================================
-- Ockham CRM — migration 003 : classement des fiches
--
-- Axonaut ne distingue que « client » (a des factures) et « prospect » (n'en a
-- pas). Or ses prospects mélangent de vrais prospects et des points de collecte
-- facturés ailleurs. Le CRM ajoute donc son propre classement :
--
--   payeur          fiche « Facturé à » : reçoit les factures, n'est pas collectée
--   client          facturé et collecté au même endroit (ex. la boulangerie)
--   point_collecte  collecté, facturé via un payeur (ex. une agence bancaire)
--   prospect        aucune relation commerciale
--   archive         fermé, ancien, doublon
--
-- Un classement déduit par l'import est « suggere » ; un commercial le passe à
-- « valide ». Une synchro ne touche jamais un classement validé.
--
-- est_payeur et est_point_collecte deviennent des colonnes calculées à partir
-- du classement : une seule vérité, pas deux informations qui peuvent diverger.
-- La base est vide de données à ce stade : la conversion est sans risque.
-- ============================================================================

alter table public.tiers
  add column statut_axonaut     text check (statut_axonaut in ('client', 'prospect')),
  add column classement         text not null default 'prospect'
                                check (classement in ('payeur', 'client', 'point_collecte', 'prospect', 'archive')),
  add column classement_statut  text not null default 'suggere'
                                check (classement_statut in ('suggere', 'valide')),
  add column classement_par     uuid references public.utilisateurs (id) on delete set null,
  add column classement_le      timestamptz,
  -- Chantier : point de collecte temporaire, qui se termine.
  add column chantier           boolean not null default false,
  add column chantier_termine   boolean not null default false;

alter table public.tiers drop column est_payeur;
alter table public.tiers drop column est_point_collecte;

alter table public.tiers
  add column est_payeur boolean
    generated always as (classement in ('payeur', 'client')) stored,
  add column est_point_collecte boolean
    generated always as (classement in ('client', 'point_collecte')) stored;

create index tiers_classement_idx on public.tiers (organisation_id, classement);

-- Le commercial peut valider ou corriger le classement et le marquage chantier.
grant update (classement, classement_statut, classement_par, classement_le,
              chantier, chantier_termine)
  on public.tiers to authenticated;

-- Contacts : civilité et consentement au suivi des emails (champ Axonaut).
alter table public.contacts
  add column civilite              text,
  add column consentement_suivi    boolean;
