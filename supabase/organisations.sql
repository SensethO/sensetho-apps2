-- ── Table : organisations ──────────────────────────────────────────────────────
-- Stocke les organisations ajoutées par les utilisateurs via DATA.GOUV
-- Chaque utilisateur gère ses propres organisations (RLS par user_id)

CREATE TABLE IF NOT EXISTS public.organisations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identifiants légaux
  siren                   TEXT UNIQUE,
  siret_siege             TEXT,
  identifiant_association TEXT,           -- RNA

  -- Dénomination
  denomination            TEXT NOT NULL,  -- nom affiché
  nom_commercial          TEXT,
  sigle                   TEXT,

  -- Statut juridique
  forme_juridique         TEXT,
  nature_juridique        TEXT,
  etat_administratif      TEXT,           -- A / C / F
  date_creation           TEXT,

  -- Activité
  activite_principale     TEXT,           -- code APE/NAF
  libelle_activite        TEXT,
  categorie_entreprise    TEXT,           -- PME / ETI / GE

  -- Effectif
  effectif_tranche        TEXT,

  -- Siège social
  adresse                 TEXT,
  code_postal             TEXT,
  ville                   TEXT,
  region                  TEXT,

  -- Caractéristiques
  est_association         BOOLEAN,
  est_ess                 BOOLEAN,
  est_societe_mission     BOOLEAN,
  est_service_public      BOOLEAN,

  -- Personnes clés (dirigeants)
  dirigeants              JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Données brutes DATA.GOUV
  raw_data                JSONB,

  -- Meta
  user_id                 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS organisations_user_id_idx  ON public.organisations(user_id);
CREATE INDEX IF NOT EXISTS organisations_siren_idx     ON public.organisations(siren) WHERE siren IS NOT NULL;
CREATE INDEX IF NOT EXISTS organisations_denom_idx     ON public.organisations USING gin(to_tsvector('french', denomination));

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS organisations_updated_at ON public.organisations;
CREATE TRIGGER organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement ses propres organisations
DROP POLICY IF EXISTS "Lecture organisations personnelles" ON public.organisations;
CREATE POLICY "Lecture organisations personnelles"
  ON public.organisations FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion : uniquement pour soi-même
DROP POLICY IF EXISTS "Insertion organisations personnelles" ON public.organisations;
CREATE POLICY "Insertion organisations personnelles"
  ON public.organisations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Mise à jour : uniquement ses propres organisations
DROP POLICY IF EXISTS "Mise a jour organisations personnelles" ON public.organisations;
CREATE POLICY "Mise a jour organisations personnelles"
  ON public.organisations FOR UPDATE
  USING (auth.uid() = user_id);

-- Suppression : uniquement ses propres organisations
DROP POLICY IF EXISTS "Suppression organisations personnelles" ON public.organisations;
CREATE POLICY "Suppression organisations personnelles"
  ON public.organisations FOR DELETE
  USING (auth.uid() = user_id);

-- Accès admin (service role bypass RLS automatiquement, pas besoin de policy)
