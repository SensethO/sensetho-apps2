-- ════════════════════════════════════════════════════════════════════════════
-- Migration : Rapport Intégré
-- ════════════════════════════════════════════════════════════════════════════

-- ── Table principale ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapports_integres (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          uuid REFERENCES auth.users NOT NULL,
  org_id           uuid REFERENCES organisations(id) ON DELETE CASCADE NOT NULL,
  annee            int NOT NULL,
  titre            text NOT NULL DEFAULT 'Rapport Intégré',
  template         text NOT NULL DEFAULT 'iirc',   -- 'iirc' | 'csrd' | 'gri'
  statut           text NOT NULL DEFAULT 'brouillon', -- 'brouillon' | 'finalise' | 'publie'
  sources          text[]  DEFAULT '{}',
  score_completion int     DEFAULT 0,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);

-- ── Table sections ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rapport_sections (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rapport_id  uuid REFERENCES rapports_integres(id) ON DELETE CASCADE NOT NULL,
  element_id  text NOT NULL,
  titre       text,
  content     text    DEFAULT '',
  data_imports jsonb  DEFAULT '[]',
  ordre       int     DEFAULT 0,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (rapport_id, element_id)
);

-- ── Index ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_rapports_integres_org  ON rapports_integres(org_id);
CREATE INDEX IF NOT EXISTS idx_rapports_integres_user ON rapports_integres(user_id);
CREATE INDEX IF NOT EXISTS idx_rapport_sections_rapport ON rapport_sections(rapport_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE rapports_integres ENABLE ROW LEVEL SECURITY;
ALTER TABLE rapport_sections  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rapports_integres' AND policyname='rapports_integres_owner') THEN
    CREATE POLICY rapports_integres_owner ON rapports_integres
      USING (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
      ));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='rapport_sections' AND policyname='rapport_sections_owner') THEN
    CREATE POLICY rapport_sections_owner ON rapport_sections
      USING (
        EXISTS (
          SELECT 1 FROM rapports_integres r
          WHERE r.id = rapport_id
            AND (r.user_id = auth.uid() OR EXISTS (
              SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
            ))
        )
      );
  END IF;
END $$;

-- ── Enregistrement dans apps ──────────────────────────────────────────────────
INSERT INTO apps (slug, name, description, icon, route, category_id, order_index, is_active)
VALUES (
  'rapport-integre',
  'Rapport Intégré',
  'Construisez votre rapport intégré IIRC / CSRD / GRI en important les données de vos diagnostics RSE.',
  '📄',
  '/rse/rapport-integre',
  '4d65b2fe-7c6a-4878-ad74-0eee704d9dd6',
  95,
  true
)
ON CONFLICT (slug) DO UPDATE SET
  category_id  = EXCLUDED.category_id,
  order_index  = EXCLUDED.order_index,
  route        = EXCLUDED.route,
  icon         = EXCLUDED.icon,
  is_active    = true;
