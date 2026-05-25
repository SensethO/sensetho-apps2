-- ============================================================
-- Green Claims — Directive UE 2024/825/EU
-- Table des allégations environnementales par organisation et année
-- ============================================================

CREATE TABLE IF NOT EXISTS public.green_claims_allegations (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year                 INTEGER NOT NULL,
  allegation_text      TEXT NOT NULL,
  type                 TEXT NOT NULL DEFAULT 'explicite'
                         CHECK (type IN ('explicite', 'generique', 'comparative', 'label-certification')),
  domain               TEXT NOT NULL DEFAULT 'general'
                         CHECK (domain IN ('general', 'energie', 'biodiversite', 'dechets', 'carbone', 'eau')),
  scope                TEXT NOT NULL DEFAULT 'produit-entier'
                         CHECK (scope IN ('produit-entier', 'composant', 'service', 'entreprise-entiere')),
  evidence_method      TEXT NOT NULL DEFAULT 'aucune'
                         CHECK (evidence_method IN ('acv-complete', 'mesure-directe', 'certification-reconnue', 'declaration-fournisseur', 'aucune')),
  third_party_verified TEXT NOT NULL DEFAULT 'nsp'
                         CHECK (third_party_verified IN ('oui', 'non', 'nsp')),
  scope_clear          TEXT NOT NULL DEFAULT 'nsp'
                         CHECK (scope_clear IN ('claire', 'vague', 'nsp')),
  no_compensation_only TEXT NOT NULL DEFAULT 'nsp'
                         CHECK (no_compensation_only IN ('correct', 'offsets-seuls', 'nsp')),
  no_hidden_impact     TEXT NOT NULL DEFAULT 'nsp'
                         CHECK (no_hidden_impact IN ('transparent', 'impacts-caches', 'nsp')),
  is_comparative       BOOLEAN NOT NULL DEFAULT false,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index utiles
CREATE INDEX IF NOT EXISTS green_claims_allegations_org_year
  ON public.green_claims_allegations (org_id, year);

-- RLS : les utilisateurs authentifiés peuvent lire/écrire
-- (l'app filtre déjà par org_id qui est validé côté client via les organisations de l'utilisateur)
ALTER TABLE public.green_claims_allegations ENABLE ROW LEVEL SECURITY;

CREATE POLICY green_claims_allegations_authenticated
  ON public.green_claims_allegations
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_green_claims_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER green_claims_allegations_updated_at
  BEFORE UPDATE ON public.green_claims_allegations
  FOR EACH ROW EXECUTE FUNCTION public.update_green_claims_updated_at();
