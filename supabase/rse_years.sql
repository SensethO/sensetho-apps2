-- ── Table : rse_years ─────────────────────────────────────────────────────────
-- Gère les années d'évaluation disponibles par organisation et par app RSE

CREATE TABLE IF NOT EXISTS public.rse_years (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  app_slug        TEXT NOT NULL,
  year            INTEGER NOT NULL,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organisation_id, app_slug, year)
);

CREATE INDEX IF NOT EXISTS rse_years_org_app_idx ON public.rse_years(organisation_id, app_slug);
CREATE INDEX IF NOT EXISTS rse_years_user_idx    ON public.rse_years(user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.rse_years ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture rse_years personnelles" ON public.rse_years;
CREATE POLICY "Lecture rse_years personnelles"
  ON public.rse_years FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Insertion rse_years personnelles" ON public.rse_years;
CREATE POLICY "Insertion rse_years personnelles"
  ON public.rse_years FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Suppression rse_years personnelles" ON public.rse_years;
CREATE POLICY "Suppression rse_years personnelles"
  ON public.rse_years FOR DELETE
  USING (auth.uid() = user_id);
