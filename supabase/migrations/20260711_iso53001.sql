-- ──────────────────────────────────────────────────────────────
-- Migration : Diagnostic ISO 53001 — Système de management des ODD
-- Basé sur ISO/UNDP PAS 53002:2024 (lignes directrices) dans l'attente
-- de la publication d'ISO/UNDP 53001 (exigences, certifiable).
-- Patron RSE « marbre » : 5 axes × 4 critères, tables <slug>_*.
-- Date : 2026-07-11
-- ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS iso53001_diagnostics (
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

CREATE TABLE IF NOT EXISTS iso53001_reponses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES iso53001_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  niveau        int DEFAULT 0,
  commentaire   text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

CREATE TABLE IF NOT EXISTS iso53001_actions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES iso53001_diagnostics(id) ON DELETE CASCADE NOT NULL,
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

CREATE TABLE IF NOT EXISTS iso53001_notes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES iso53001_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  content       text,
  sections      jsonb DEFAULT '[]',
  attachment_counter int DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

-- Partage : via la table générique rse_diagnostic_shares (app_slug = 'iso53001'),
-- comme sapin2/vigilance — pas de table dédiée.

-- RLS
ALTER TABLE iso53001_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso53001_reponses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso53001_actions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE iso53001_notes       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iso53001_diagnostics' AND policyname='iso53001_diag_own') THEN
    CREATE POLICY "iso53001_diag_own" ON iso53001_diagnostics FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iso53001_reponses' AND policyname='iso53001_rep_own') THEN
    CREATE POLICY "iso53001_rep_own" ON iso53001_reponses FOR ALL USING (
      diagnostic_id IN (SELECT id FROM iso53001_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iso53001_actions' AND policyname='iso53001_actions_own') THEN
    CREATE POLICY "iso53001_actions_own" ON iso53001_actions FOR ALL USING (
      diagnostic_id IN (SELECT id FROM iso53001_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='iso53001_notes' AND policyname='iso53001_notes_own') THEN
    CREATE POLICY "iso53001_notes_own" ON iso53001_notes FOR ALL USING (
      diagnostic_id IN (SELECT id FROM iso53001_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- Fonction atomique pour préfixe annexes A001_
CREATE OR REPLACE FUNCTION increment_iso53001_notes_counter(p_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter int;
BEGIN
  UPDATE iso53001_diagnostics
    SET attachment_counter = attachment_counter + 1
    WHERE id = p_id
    RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END;
$$;

-- Catalogue (catégorie RSE, tarification sur devis)
INSERT INTO apps (slug, name, description, route, icon, category_id, is_active, pricing_type, is_for_sale)
VALUES (
  'iso53001',
  'Diagnostic ISO 53001 — ODD',
  'Diagnostic de maturité du système de management des Objectifs de Développement Durable (ODD) selon ISO/UNDP 53001 (basé sur PAS 53002:2024) : contexte & parties prenantes, leadership, planification, opération & support, évaluation & amélioration.',
  '/rse/iso53001',
  '🎯',
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
