-- ──────────────────────────────────────────────────────────────
-- Migration : Application Loi Sapin II — Conformité Anti-Corruption
-- Date : 2026-06-06
-- ──────────────────────────────────────────────────────────────

-- Tables Sapin II

CREATE TABLE IF NOT EXISTS sapin2_diagnostics (
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

CREATE TABLE IF NOT EXISTS sapin2_reponses (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES sapin2_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  niveau        int DEFAULT 0,
  commentaire   text,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

CREATE TABLE IF NOT EXISTS sapin2_actions (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES sapin2_diagnostics(id) ON DELETE CASCADE NOT NULL,
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

CREATE TABLE IF NOT EXISTS sapin2_notes (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id uuid REFERENCES sapin2_diagnostics(id) ON DELETE CASCADE NOT NULL,
  critere_id    text NOT NULL,
  content       text,
  sections      jsonb DEFAULT '[]',
  attachment_counter int DEFAULT 0,
  updated_at    timestamptz DEFAULT now(),
  UNIQUE(diagnostic_id, critere_id)
);

-- RLS

ALTER TABLE sapin2_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapin2_reponses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapin2_actions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE sapin2_notes       ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sapin2_diagnostics' AND policyname='sapin2_diag_own') THEN
    CREATE POLICY "sapin2_diag_own" ON sapin2_diagnostics FOR ALL USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sapin2_reponses' AND policyname='sapin2_rep_own') THEN
    CREATE POLICY "sapin2_rep_own" ON sapin2_reponses FOR ALL USING (
      diagnostic_id IN (SELECT id FROM sapin2_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sapin2_actions' AND policyname='sapin2_actions_own') THEN
    CREATE POLICY "sapin2_actions_own" ON sapin2_actions FOR ALL USING (
      diagnostic_id IN (SELECT id FROM sapin2_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='sapin2_notes' AND policyname='sapin2_notes_own') THEN
    CREATE POLICY "sapin2_notes_own" ON sapin2_notes FOR ALL USING (
      diagnostic_id IN (SELECT id FROM sapin2_diagnostics WHERE user_id = auth.uid())
    );
  END IF;
END $$;

-- Fonction atomique pour préfixe annexes A001_

CREATE OR REPLACE FUNCTION increment_sapin2_notes_counter(p_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter int;
BEGIN
  UPDATE sapin2_diagnostics
    SET attachment_counter = attachment_counter + 1
    WHERE id = p_id
    RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END;
$$;

-- Enregistrement de l'app dans le catalogue
-- (adapter category_id selon votre table app_categories)
INSERT INTO apps (slug, name, description, route, icon, is_active)
VALUES (
  'sapin2',
  'Loi Sapin II — Conformité Anti-Corruption',
  'Diagnostic de maturité du programme anti-corruption (5 axes × 4 critères) : gouvernance, cartographie des risques, prévention, gestion des tiers, détection & remédiation. Conforme aux recommandations AFA.',
  '/rse/sapin2',
  '⚖️',
  true
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  route = EXCLUDED.route,
  icon = EXCLUDED.icon,
  is_active = EXCLUDED.is_active;
