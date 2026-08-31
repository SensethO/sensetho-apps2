-- ──────────────────────────────────────────────────────────────
-- Migration : Conformité ECGT — Allégations & greenwashing
-- Directive (UE) 2024/825 « Empowering Consumers for the Green Transition »
-- (modifie la directive 2005/29/CE — pratiques commerciales déloyales —
--  et la directive 2011/83/UE — droits des consommateurs).
-- Transposition nationale : 27 mars 2026 · Application : 27 septembre 2026.
--
-- Patron RSE « marbre » : 5 axes × 4 critères, tables <slug>_*.
-- + deux tables propres à l'analyse de contenus réels :
--   ecgt_contenus (contenus soumis) et ecgt_constats (non-conformités relevées).
--
-- Idempotente. NE PAS APPLIQUER automatiquement (jeton révoqué) :
-- à exécuter manuellement via la Management API Supabase.
-- Date : 2026-08-31
-- ──────────────────────────────────────────────────────────────

-- ─── 1. Les 4 tables du marbre ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ecgt_diagnostics (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             uuid REFERENCES auth.users NOT NULL,
  org_id              uuid REFERENCES organisations(id) NOT NULL,
  annee               int NOT NULL,
  statut              text DEFAULT 'en_cours',
  score_global        int,
  attachment_counter  int DEFAULT 0,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(user_id, org_id, annee)
);

CREATE TABLE IF NOT EXISTS ecgt_reponses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES ecgt_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  niveau        int DEFAULT 0,
  commentaire   text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

CREATE TABLE IF NOT EXISTS ecgt_actions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES ecgt_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  titre         text NOT NULL,
  description   text,
  priorite      text DEFAULT 'moyenne',
  statut        text DEFAULT 'a_faire',
  echeance      date,
  responsable   text,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ecgt_notes (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id      uuid REFERENCES ecgt_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id         text NOT NULL,
  content            text,
  sections           jsonb DEFAULT '[]',
  attachment_counter int DEFAULT 0,
  updated_at         timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

-- ─── 2. Tables propres à l'analyse de contenus ───────────────────────────────

-- Contenus soumis à l'analyse (page web, document, visuel, vidéo, texte collé).
-- Les fichiers eux-mêmes restent dans SharePoint (sharepoint_item_id) :
-- aucun octet ne transite par Vercel ni par Supabase.
CREATE TABLE IF NOT EXISTS ecgt_contenus (
  id                 uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id      uuid REFERENCES ecgt_diagnostics(id) ON DELETE CASCADE NOT NULL,
  type               text NOT NULL CHECK (type IN ('url','document','image','video','texte')),
  titre              text,
  url                text,
  sharepoint_item_id text,
  mime               text,
  taille             bigint,
  -- Texte extrait de la page, collé par l'utilisateur, ou script/sous-titres d'une vidéo.
  texte_source       text,
  statut             text NOT NULL DEFAULT 'a_analyser' CHECK (statut IN ('a_analyser','analyse','erreur')),
  analysed_at        timestamptz,
  erreur             text,
  created_at         timestamptz DEFAULT now(),
  updated_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecgt_contenus_diagnostic_idx ON ecgt_contenus(diagnostic_id, created_at);

-- Constats de non-conformité relevés sur un contenu.
CREATE TABLE IF NOT EXISTS ecgt_constats (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  contenu_id    uuid REFERENCES ecgt_contenus(id) ON DELETE CASCADE NOT NULL,
  -- Renvoie à un critère de src/lib/ecgt/referentiel.ts (ECGT_CRITERE_IDS).
  critere_id    text NOT NULL,
  gravite       text NOT NULL CHECK (gravite IN ('critique','majeur','mineur','vigilance')),
  -- Citation EXACTE du passage fautif dans le contenu analysé.
  extrait       text NOT NULL,
  probleme      text,
  -- Base juridique, formulation prudente (ex. « pratique visée par la liste noire de l'annexe I »).
  article_vise  text,
  -- Réécriture conforme proposée par l'IA.
  suggestion    text,
  justification text,
  statut        text NOT NULL DEFAULT 'ouvert' CHECK (statut IN ('ouvert','corrige','ecarte')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ecgt_constats_contenu_idx ON ecgt_constats(contenu_id, created_at);
CREATE INDEX IF NOT EXISTS ecgt_constats_critere_idx ON ecgt_constats(critere_id);

-- Partage : via la table générique rse_diagnostic_shares (app_slug = 'ecgt'),
-- comme iso53001/vigilance — pas de table dédiée.

-- ─── 3. RLS sur TOUTES les tables ────────────────────────────────────────────

ALTER TABLE ecgt_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecgt_reponses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecgt_actions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecgt_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecgt_contenus    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ecgt_constats    ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_diagnostics' AND policyname='ecgt_diag_own') THEN
    CREATE POLICY "ecgt_diag_own" ON ecgt_diagnostics FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_reponses' AND policyname='ecgt_rep_own') THEN
    CREATE POLICY "ecgt_rep_own" ON ecgt_reponses FOR ALL USING (
      diagnostic_id IN (SELECT id FROM ecgt_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_actions' AND policyname='ecgt_actions_own') THEN
    CREATE POLICY "ecgt_actions_own" ON ecgt_actions FOR ALL USING (
      diagnostic_id IN (SELECT id FROM ecgt_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_notes' AND policyname='ecgt_notes_own') THEN
    CREATE POLICY "ecgt_notes_own" ON ecgt_notes FOR ALL USING (
      diagnostic_id IN (SELECT id FROM ecgt_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_contenus' AND policyname='ecgt_contenus_own') THEN
    CREATE POLICY "ecgt_contenus_own" ON ecgt_contenus FOR ALL USING (
      diagnostic_id IN (SELECT id FROM ecgt_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='ecgt_constats' AND policyname='ecgt_constats_own') THEN
    CREATE POLICY "ecgt_constats_own" ON ecgt_constats FOR ALL USING (
      contenu_id IN (
        SELECT c.id FROM ecgt_contenus c
        JOIN ecgt_diagnostics d ON d.id = c.diagnostic_id
        WHERE d.user_id = auth.uid()
      )
    );
  END IF;
END $$;

-- ─── 4. Fonction atomique pour les préfixes d'annexes A00x_ ──────────────────

CREATE OR REPLACE FUNCTION increment_ecgt_notes_counter(p_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter int;
BEGIN
  UPDATE ecgt_diagnostics
    SET attachment_counter = attachment_counter + 1,
        updated_at = now()
    WHERE id = p_id
    RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END;
$$;

-- ─── 5. Catalogue (catégorie RSE, tarification sur devis) ────────────────────
-- Icône '🔬' : vérifiée libre au 2026-08-31. Le microscope a été préféré à la
-- loupe '🔎' : celle-ci est certes un point de code distinct de '🔍' (iso26000),
-- mais les deux sont indiscernables dans une liste. Les icônes du catalogue
-- doivent rester uniques ET lisibles — cf. migration 20260713_app_icons.sql.

INSERT INTO apps (slug, name, description, route, icon, category_id, is_active, pricing_type, is_for_sale)
VALUES (
  'ecgt',
  'Conformité ECGT — Allégations & greenwashing',
  'Diagnostic et audit de conformité à la directive (UE) 2024/825 « Empowering Consumers for the Green Transition » : allégations environnementales, labels et certifications, neutralité carbone et compensation, durabilité et réparabilité, gouvernance des communications. Analyse par IA de contenus réels (page web, document, visuel, script de vidéo, texte) avec rapport de non-conformités et réécritures conformes. Transposition au 27 mars 2026, application au 27 septembre 2026.',
  '/rse/ecgt',
  '🔬',
  '4d65b2fe-7c6a-4878-ad74-0eee704d9dd6',
  true,
  'quote',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  category_id = EXCLUDED.category_id,
  is_active = EXCLUDED.is_active,
  pricing_type = EXCLUDED.pricing_type;
