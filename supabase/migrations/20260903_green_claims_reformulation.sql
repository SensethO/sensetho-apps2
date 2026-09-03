-- ════════════════════════════════════════════════════════════════════════════
-- Green Claims — reformulation conforme retenue (finalité du diagnostic)
-- Ajoute, par allégation, la version corrigée conforme (avant → après).
-- Additif et idempotent. À exécuter via le SQL Editor Supabase ou l'API Management.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.green_claims_allegations
  ADD COLUMN IF NOT EXISTS reformulation TEXT;
