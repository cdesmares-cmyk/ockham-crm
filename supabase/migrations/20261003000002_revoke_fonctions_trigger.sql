-- ============================================================================
-- Ockham CRM — migration 002 : fermer l'appel direct des fonctions de trigger
--
-- L'analyse de sécurité Supabase signale que les deux garde-fous de la
-- migration 001 sont appelables via /rest/v1/rpc, y compris sans connexion.
-- Postgres refuse de toute façon d'exécuter une fonction de trigger hors d'un
-- trigger : pas de faille, mais on ferme la porte.
--
-- Les triggers continuent de fonctionner : le droit EXECUTE n'est vérifié
-- qu'à la création du trigger, pas à son déclenchement.
-- ============================================================================

revoke execute on function public.verifier_rattachement_meme_org() from public, anon, authenticated;
revoke execute on function public.verifier_contact_meme_org()      from public, anon, authenticated;
revoke execute on function public.maj_updated_at()                 from public, anon, authenticated;
