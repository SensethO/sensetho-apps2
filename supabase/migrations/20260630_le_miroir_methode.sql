-- ════════════════════════════════════════════════════════════════════════════
-- Le Miroir — traçabilité du mode de construction du portrait
-- Ajoute : methode ('manuel' | 'ia'), prompt (questions ouvertes saisies),
-- ia (réponse complète de l'IA : justification + profil sectoriel).
-- Permet d'« ouvrir » un portrait dans le miroir et de voir ce qui a été
-- prompté et ce que l'IA a répondu.
--
-- Idempotent (IF NOT EXISTS). À exécuter via le SQL Editor Supabase (projet
-- ketnixnfrbpdpduypfbv) ou la Management API.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.le_miroir_portraits
  ADD COLUMN IF NOT EXISTS methode TEXT NOT NULL DEFAULT 'manuel' CHECK (methode IN ('manuel', 'ia')),
  ADD COLUMN IF NOT EXISTS prompt JSONB,
  ADD COLUMN IF NOT EXISTS ia JSONB;
