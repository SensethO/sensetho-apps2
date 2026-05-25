-- ============================================================
-- VSME EFRAG — Voluntary Sustainability Reporting Standard pour PME
-- Module de Base (40 datapoints) + Module Complet (23 datapoints)
-- ============================================================

-- Table des réponses aux datapoints
CREATE TABLE IF NOT EXISTS public.vsme_responses (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id          UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year            INTEGER NOT NULL,
  datapoint_code  TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'non_evalue'
                    CHECK (status IN ('non_evalue', 'non_applicable', 'non_renseigne', 'en_cours', 'renseigne')),
  value_text      TEXT,
  value_number    NUMERIC,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, year, datapoint_code)
);

CREATE INDEX IF NOT EXISTS vsme_responses_org_year
  ON public.vsme_responses (org_id, year);

ALTER TABLE public.vsme_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsme_responses_authenticated
  ON public.vsme_responses
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_vsme_responses_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vsme_responses_updated_at
  BEFORE UPDATE ON public.vsme_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_vsme_responses_updated_at();

-- ─── Table des paramètres VSME par organisation/année ───────────────────────

CREATE TABLE IF NOT EXISTS public.vsme_settings (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id      UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year        INTEGER NOT NULL,
  module_type TEXT NOT NULL DEFAULT 'base'
                CHECK (module_type IN ('base', 'complet')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(org_id, year)
);

ALTER TABLE public.vsme_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsme_settings_authenticated
  ON public.vsme_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_vsme_settings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER vsme_settings_updated_at
  BEFORE UPDATE ON public.vsme_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_vsme_settings_updated_at();
