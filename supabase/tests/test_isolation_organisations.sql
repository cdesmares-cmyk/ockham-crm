-- ============================================================================
-- Test d'isolation entre organisations (à rejouer après chaque nouvelle table)
--
-- Tout se passe dans une transaction annulée à la fin (ROLLBACK) : aucune
-- donnée ne reste en base. Deux organisations fictives A et B, un commercial
-- dans chacune, puis on se met « dans la peau » du commercial A comme le ferait
-- l'API (rôle authenticated + identifiant dans le jeton) et on compte ce qu'il voit.
--
-- Résultat attendu : chaque ligne du tableau final affiche ok = true.
-- Lancement : npx supabase db query --linked -f supabase/tests/test_isolation_organisations.sql
-- ============================================================================

begin;

create temp table resultats (test text, attendu text, obtenu text, ok boolean) on commit drop;
grant all on resultats to authenticated, anon;

-- Données fictives -----------------------------------------------------------
insert into public.organisations (id, nom) values
  ('00000000-0000-0000-0000-00000000000a', 'TEST Org A'),
  ('00000000-0000-0000-0000-00000000000b', 'TEST Org B');

insert into auth.users (id, email, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'test-a@ockham.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'test-b@ockham.invalid', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'test-sans-org@ockham.invalid', 'authenticated', 'authenticated');

insert into public.utilisateurs (id, organisation_id, role, email) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'commercial', 'test-a@ockham.invalid'),
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000000b', 'commercial', 'test-b@ockham.invalid');

insert into public.entreprises (id, organisation_id, siren) values
  ('00000000-0000-0000-0000-0000000e000a', '00000000-0000-0000-0000-00000000000a', '111111111'),
  ('00000000-0000-0000-0000-0000000e000b', '00000000-0000-0000-0000-00000000000b', '222222222');

insert into public.tiers (id, organisation_id, axonaut_id, nom, est_payeur) values
  ('00000000-0000-0000-0000-00000000a001', '00000000-0000-0000-0000-00000000000a', 1, 'Client A1', true),
  ('00000000-0000-0000-0000-00000000a002', '00000000-0000-0000-0000-00000000000a', 2, 'Site A2', false),
  ('00000000-0000-0000-0000-00000000b001', '00000000-0000-0000-0000-00000000000b', 1, 'Client B1', true);

insert into public.contacts (organisation_id, tiers_id, email) values
  ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000a001', 'contact@a.invalid'),
  ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000b001', 'contact@b.invalid');

insert into public.factures (organisation_id, axonaut_id, tiers_id, date_facture, montant_ht) values
  ('00000000-0000-0000-0000-00000000000a', 1, '00000000-0000-0000-0000-00000000a001', '2026-09-30', 100),
  ('00000000-0000-0000-0000-00000000000b', 1, '00000000-0000-0000-0000-00000000b001', '2026-09-30', 999);

insert into public.sync_runs (organisation_id, source) values
  ('00000000-0000-0000-0000-00000000000a', 'axonaut'),
  ('00000000-0000-0000-0000-00000000000b', 'axonaut');

-- Dans la peau du commercial A ------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

insert into resultats select 'A voit son organisation seulement', '1', count(*)::text, count(*) = 1 from public.organisations;
insert into resultats select 'A voit les utilisateurs de A seulement', '1', count(*)::text, count(*) = 1 from public.utilisateurs;
insert into resultats select 'A voit les entreprises de A seulement', '1', count(*)::text, count(*) = 1 from public.entreprises;
insert into resultats select 'A voit les fiches de A seulement', '2', count(*)::text, count(*) = 2 from public.tiers;
insert into resultats select 'A voit les contacts de A seulement', '1', count(*)::text, count(*) = 1 from public.contacts;
insert into resultats select 'A voit les factures de A seulement', '100.00', sum(montant_ht)::text, sum(montant_ht) = 100 from public.factures;
insert into resultats select 'A voit les synchros de A seulement', '1', count(*)::text, count(*) = 1 from public.sync_runs;

-- A ne peut pas modifier une fiche de B (0 ligne touchée)
with m as (update public.tiers set consignes = 'piratage' where id = '00000000-0000-0000-0000-00000000b001' returning 1)
insert into resultats select 'A ne modifie pas une fiche de B', '0', count(*)::text, count(*) = 0 from m;

-- A peut rattacher son site à son payeur
with m as (update public.tiers set payeur_id = '00000000-0000-0000-0000-00000000a001', rattachement_statut = 'valide'
           where id = '00000000-0000-0000-0000-00000000a002' returning 1)
insert into resultats select 'A rattache son site à son payeur', '1', count(*)::text, count(*) = 1 from m;

-- A ne peut pas rattacher son site à un payeur de B
do $$
begin
  update public.tiers set payeur_id = '00000000-0000-0000-0000-00000000b001'
  where id = '00000000-0000-0000-0000-00000000a002';
  insert into resultats values ('A ne rattache pas à un payeur de B', 'refusé', 'accepté', false);
exception when others then
  insert into resultats values ('A ne rattache pas à un payeur de B', 'refusé', 'refusé', true);
end $$;

-- A ne peut pas modifier le CA d'une fiche
do $$
begin
  update public.tiers set ca_total = 0 where id = '00000000-0000-0000-0000-00000000a001';
  insert into resultats values ('A ne modifie pas le CA', 'refusé', 'accepté', false);
exception when insufficient_privilege then
  insert into resultats values ('A ne modifie pas le CA', 'refusé', 'refusé', true);
end $$;

-- A ne peut pas se donner le rôle admin
do $$
declare n int;
begin
  update public.utilisateurs set role = 'admin' where id = '00000000-0000-0000-0000-0000000000a1';
  get diagnostics n = row_count;
  insert into resultats values ('A ne se donne pas le rôle admin', 'refusé', case when n = 0 then 'refusé' else 'accepté' end, n = 0);
exception when insufficient_privilege then
  insert into resultats values ('A ne se donne pas le rôle admin', 'refusé', 'refusé', true);
end $$;

-- A ne peut pas créer un contact dans l'organisation B
do $$
begin
  insert into public.contacts (organisation_id, tiers_id, email)
  values ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000b001', 'intrus@a.invalid');
  insert into resultats values ('A ne crée pas de contact chez B', 'refusé', 'accepté', false);
exception when others then
  insert into resultats values ('A ne crée pas de contact chez B', 'refusé', 'refusé', true);
end $$;

-- Un compte connecté SANS fiche utilisateur ne voit rien ----------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
insert into resultats select 'Compte sans organisation : 0 fiche', '0', count(*)::text, count(*) = 0 from public.tiers;
insert into resultats select 'Compte sans organisation : 0 facture', '0', count(*)::text, count(*) = 0 from public.factures;

-- Visiteur non connecté (anon) ------------------------------------------------
reset role;
set local role anon;
do $$
begin
  perform 1 from public.tiers limit 1;
  insert into resultats values ('Visiteur non connecté : accès refusé', 'refusé', 'accepté', false);
exception when insufficient_privilege then
  insert into resultats values ('Visiteur non connecté : accès refusé', 'refusé', 'refusé', true);
end $$;

reset role;
select test, attendu, obtenu, ok from resultats;

rollback;
