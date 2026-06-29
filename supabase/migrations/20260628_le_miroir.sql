-- ════════════════════════════════════════════════════════════════════════════
-- Application RSE « Le Miroir » (slug: le-miroir)
-- Le miroir collectif : les parties prenantes peignent l'organisation, ses
-- services et managers (en tant que rôle) en espèces + habitats (marché/cité),
-- avec un verdict d'adéquation par milieu. Agrégation = écarts de perception.
--
-- Modèle calqué sur vos conventions (owner + partage par ressource, cf.
-- guided_diagnostic_shares / iso26000) :
--   campagne (owner = responsable) → shares (participants invités)
--   participants (poste/service)   → portraits (les évaluations)
-- Lecture collective d'une campagne = owner OU partagé OU admin.
--
-- À exécuter via la Supabase Management API (project ref ketnixnfrbpdpduypfbv)
-- avec un PAT valide :
--   curl -X POST "https://api.supabase.com/v1/projects/ketnixnfrbpdpduypfbv/database/query" \
--     -H "Authorization: Bearer <PAT>" -H "Content-Type: application/json" \
--     -d '{"query": "<contenu de ce fichier>"}'
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Campagnes (une par organisation + année, possédée par le responsable) ────
CREATE TABLE IF NOT EXISTS public.le_miroir_campagnes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id      UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  annee       INTEGER NOT NULL,
  nom         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(owner_id, org_id, annee)
);

-- ─── Partages : le responsable invite des participants ────────────────────────
CREATE TABLE IF NOT EXISTS public.le_miroir_campagne_shares (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id          UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  shared_with_user_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campagne_id, shared_with_user_id)
);

-- ─── Participants : chacun déclare son poste et son service ───────────────────
CREATE TABLE IF NOT EXISTS public.le_miroir_participants (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id  UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  poste        TEXT,
  service      TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campagne_id, user_id)
);

-- ─── Portraits : les évaluations (espèce + 2 habitats + 2 verdicts) ───────────
CREATE TABLE IF NOT EXISTS public.le_miroir_portraits (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id        UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  etre_key           TEXT NOT NULL,            -- ex: 'entreprise', 'service:Commercial', 'manager:...'
  etre_label         TEXT NOT NULL,
  espece_id          TEXT NOT NULL,
  habitat_marche_id  TEXT NOT NULL,
  habitat_cite_id    TEXT NOT NULL,
  verdict_marche     INTEGER NOT NULL CHECK (verdict_marche BETWEEN 1 AND 4),
  verdict_cite       INTEGER NOT NULL CHECK (verdict_cite BETWEEN 1 AND 4),
  justification      TEXT,
  kind               TEXT NOT NULL DEFAULT 'individuel' CHECK (kind IN ('individuel','auto')),
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS le_miroir_portraits_campagne_idx ON public.le_miroir_portraits(campagne_id);
CREATE INDEX IF NOT EXISTS le_miroir_participants_campagne_idx ON public.le_miroir_participants(campagne_id);
CREATE INDEX IF NOT EXISTS le_miroir_shares_user_idx ON public.le_miroir_campagne_shares(shared_with_user_id);

-- ════════════════════════════════════════════════════════════════════════════
-- RLS
-- ════════════════════════════════════════════════════════════════════════════
ALTER TABLE public.le_miroir_campagnes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.le_miroir_campagne_shares  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.le_miroir_participants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.le_miroir_portraits         ENABLE ROW LEVEL SECURITY;

-- Helper : accès à une campagne (owner OU partagé OU admin)
CREATE OR REPLACE FUNCTION public.le_miroir_can_access(c_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.le_miroir_campagnes c
    WHERE c.id = c_id AND (
      c.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.le_miroir_campagne_shares s
                 WHERE s.campagne_id = c.id AND s.shared_with_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    )
  );
$$;

-- Campagnes : lecture si accès ; gestion par le propriétaire (ou admin)
CREATE POLICY le_miroir_campagnes_read ON public.le_miroir_campagnes
  FOR SELECT USING (public.le_miroir_can_access(id));
CREATE POLICY le_miroir_campagnes_insert ON public.le_miroir_campagnes
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY le_miroir_campagnes_update ON public.le_miroir_campagnes
  FOR UPDATE USING (owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));
CREATE POLICY le_miroir_campagnes_delete ON public.le_miroir_campagnes
  FOR DELETE USING (owner_id = auth.uid());

-- Partages : gérés par le propriétaire de la campagne ; le bénéficiaire voit le sien
CREATE POLICY le_miroir_shares_owner ON public.le_miroir_campagne_shares
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
    OR shared_with_user_id = auth.uid()
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

-- Participants : lecture collective si accès campagne ; chacun gère SA ligne
CREATE POLICY le_miroir_participants_read ON public.le_miroir_participants
  FOR SELECT USING (public.le_miroir_can_access(campagne_id));
CREATE POLICY le_miroir_participants_write ON public.le_miroir_participants
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.le_miroir_can_access(campagne_id));
CREATE POLICY le_miroir_participants_update ON public.le_miroir_participants
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Portraits : lecture COLLECTIVE si accès campagne (le miroir agrège) ; écriture = la sienne
CREATE POLICY le_miroir_portraits_read ON public.le_miroir_portraits
  FOR SELECT USING (public.le_miroir_can_access(campagne_id));
CREATE POLICY le_miroir_portraits_insert ON public.le_miroir_portraits
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.le_miroir_can_access(campagne_id));
CREATE POLICY le_miroir_portraits_update ON public.le_miroir_portraits
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY le_miroir_portraits_delete ON public.le_miroir_portraits
  FOR DELETE USING (user_id = auth.uid());

-- ════════════════════════════════════════════════════════════════════════════
-- Inscription de l'app dans le catalogue (menu)
-- ════════════════════════════════════════════════════════════════════════════
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active)
SELECT
  'Le Miroir — éthologie d''entreprise',
  'le-miroir',
  'Le miroir collectif : faites peindre votre organisation (espèces + habitats marché/cité) par ses parties prenantes, et révélez les écarts de perception.',
  'eye',
  '/rse/le-miroir',
  id,
  60,
  true
FROM public.app_categories WHERE slug = 'rse'
ON CONFLICT (slug) DO NOTHING;
