-- ════════════════════════════════════════════════════════════════════════════
-- Partage des diagnostics RSE marbre (toutes apps : collecte-rse, gpsr, bilan-ges,
-- act-carbone, label-nr, bcorp, iso45001, iso50001, afaq26000, eudr, vigilance…)
--
-- Table générique : diagnostic_id pointe vers <slug>_diagnostics (pas de FK car
-- multi-tables). app_slug discrimine. L'accès passe toujours par les routes API
-- (service role) → RLS verrouillée (service role bypass).
-- ════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.rse_diagnostic_shares (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug            text NOT NULL,
  diagnostic_id       uuid NOT NULL,
  shared_with_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission          text NOT NULL DEFAULT 'read' CHECK (permission IN ('read','edit')),
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE(app_slug, diagnostic_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS rse_diagnostic_shares_recipient_idx
  ON public.rse_diagnostic_shares (app_slug, shared_with_user_id);
CREATE INDEX IF NOT EXISTS rse_diagnostic_shares_diag_idx
  ON public.rse_diagnostic_shares (app_slug, diagnostic_id);

ALTER TABLE public.rse_diagnostic_shares ENABLE ROW LEVEL SECURITY;
-- Aucune policy permissive : tout l'accès se fait via les routes API (service role,
-- qui bypass RLS). Les clients anon/authenticated ne lisent jamais la table en direct.
