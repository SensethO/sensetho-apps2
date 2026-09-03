-- ════════════════════════════════════════════════════════════════════════════
-- Green Claims — analyse IA (portage depuis la v1 app.sensetho.fr)
-- Ajoute la persistance de l'analyse IA du diagnostic + empreinte pour le cache.
--   ai_analysis     : texte de l'analyse générée (Directive UE 2024/825)
--   ai_generated_at : horodatage de génération
--   ai_fingerprint  : empreinte des allégations (id:score) → régénère seulement si changement
--
-- Additif et idempotent (ADD COLUMN IF NOT EXISTS). À exécuter via le SQL Editor
-- Supabase (projet ketnixnfrbpdpduypfbv) ou la Management API.
-- Le code est résilient : si ces colonnes n'existent pas encore, l'analyse
-- fonctionne quand même (sans cache) — la persistance échoue silencieusement.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.green_claims_diagnostics
  ADD COLUMN IF NOT EXISTS ai_analysis     TEXT,
  ADD COLUMN IF NOT EXISTS ai_generated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ai_fingerprint  TEXT;
