-- ════════════════════════════════════════════════════════════════════════════
-- Application RSE « Collecte documentaire RSE » (slug: collecte-rse)
-- 4 tables collecte_rse_* + RLS (calquées sur gpsr_*) + fonction de compteur.
--
-- À exécuter via la Supabase Management API (project ref ketnixnfrbpdpduypfbv)
-- lorsqu'un PAT valide est disponible :
--   curl -X POST "https://api.supabase.com/v1/projects/ketnixnfrbpdpduypfbv/database/query" \
--     -H "Authorization: Bearer <PAT>" -H "Content-Type: application/json" \
--     -d @20260618_collecte_rse.sql   (encapsuler dans {"query": "..."} )
--
-- NB : les lignes catalogue `apps` (slug collecte-rse) et `sp_app_routes`
-- (app_key collecte-rse-diagnostic, folder COLLECTE-RSE-DIAG) ont déjà été
-- insérées via PostgREST (service role) le 2026-06-18.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Diagnostic principal ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collecte_rse_diagnostics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,
  annee INTEGER NOT NULL,
  statut TEXT DEFAULT 'en_cours',
  score_global INTEGER,
  attachment_counter INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, org_id, annee)
);

-- ─── Réponses par critère (état du document) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collecte_rse_reponses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.collecte_rse_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  niveau INTEGER DEFAULT 0,
  commentaire TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnostic_id, critere_id)
);

-- ─── Actions de collecte ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collecte_rse_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.collecte_rse_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  titre TEXT NOT NULL,
  description TEXT,
  priorite TEXT DEFAULT 'moyenne',
  statut TEXT DEFAULT 'a_faire',
  echeance TEXT,
  responsable TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Notes & documents (Tiptap + pièces jointes SharePoint) ──────────────────
CREATE TABLE IF NOT EXISTS public.collecte_rse_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.collecte_rse_diagnostics(id) ON DELETE CASCADE,
  critere_id TEXT NOT NULL,
  content TEXT,
  sections JSONB DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(diagnostic_id, critere_id)
);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.collecte_rse_diagnostics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collecte_rse_reponses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collecte_rse_actions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collecte_rse_notes       ENABLE ROW LEVEL SECURITY;

-- diagnostics : propriétaire ou admin
CREATE POLICY collecte_rse_diagnostics_owner ON public.collecte_rse_diagnostics
  FOR ALL USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- reponses : via le diagnostic parent
CREATE POLICY collecte_rse_reponses_owner ON public.collecte_rse_reponses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

-- actions : via le diagnostic parent
CREATE POLICY collecte_rse_actions_owner ON public.collecte_rse_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

-- notes : via le diagnostic parent
CREATE POLICY collecte_rse_notes_owner ON public.collecte_rse_notes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.collecte_rse_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')))
  );

-- ─── Fonction atomique de compteur d'annexes (préfixes A001_) ────────────────
CREATE OR REPLACE FUNCTION public.increment_collecte_rse_notes_counter(p_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.collecte_rse_diagnostics
  SET attachment_counter = attachment_counter + 1, updated_at = NOW()
  WHERE id = p_id
  RETURNING attachment_counter;
$$;

-- ─── Catalogue (déjà inséré via PostgREST, fourni pour référence) ─────────────
-- INSERT INTO public.apps (name, slug, description, icon, route, category_id, is_active, pricing_type, is_for_sale)
-- VALUES ('Collecte documentaire RSE', 'collecte-rse', '...', '🗂️', '/rse/collecte-rse',
--         '4d65b2fe-7c6a-4878-ad74-0eee704d9dd6', true, 'free', true)
-- ON CONFLICT (slug) DO NOTHING;
--
-- INSERT INTO public.sp_app_routes (app_key, sp_config_id, folder_name)
-- VALUES ('collecte-rse-diagnostic', 'd05f7097-aaf1-4a1a-a685-ba0755f8f4a0', 'COLLECTE-RSE-DIAG')
-- ON CONFLICT DO NOTHING;
