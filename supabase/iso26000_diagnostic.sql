-- ============================================================
-- ISO 26000 Diagnostic complet (37 domaines, 7 questions centrales)
-- ============================================================

-- Table principale : un diagnostic par (user, org, year)
CREATE TABLE IF NOT EXISTS public.iso26000_diagnostics (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id  UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year             INTEGER NOT NULL,
  -- Scores 0-5 par domaine : { "DA1.1": 3, "DA2.1": 0, ... }
  scores           JSONB NOT NULL DEFAULT '{}',
  -- Progression actions 0-10 : { "DA1.1_0": 7, "DA1.1_1": 5, ... }
  action_progress  JSONB NOT NULL DEFAULT '{}',
  -- Actions N/A : { "DA1.1_2": true }
  action_na        JSONB NOT NULL DEFAULT '{}',
  -- Analyse IA
  ai_analysis      TEXT,
  ai_scores        JSONB,
  ai_generated_at  TIMESTAMPTZ,
  -- Compteur atomique pour les préfixes A001_ des annexes (jamais réinitialisé)
  attachment_counter INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organisation_id, year)
);

ALTER TABLE public.iso26000_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY iso26000_diag_owner ON public.iso26000_diagnostics FOR ALL
  USING (auth.uid() = user_id);

-- Partages
CREATE TABLE IF NOT EXISTS public.iso26000_diagnostic_shares (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id         UUID NOT NULL REFERENCES public.iso26000_diagnostics(id) ON DELETE CASCADE,
  shared_with_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by             UUID REFERENCES auth.users(id),
  permission            TEXT NOT NULL DEFAULT 'read',  -- 'read' | 'edit'
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnostic_id, shared_with_user_id)
);

ALTER TABLE public.iso26000_diagnostic_shares ENABLE ROW LEVEL SECURITY;
CREATE POLICY iso26000_shares_owner ON public.iso26000_diagnostic_shares FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.iso26000_diagnostics d WHERE d.id = diagnostic_id AND d.user_id = auth.uid())
    OR shared_with_user_id = auth.uid()
  );

-- Notes / sections Tiptap par action
CREATE TABLE IF NOT EXISTS public.iso26000_action_notes (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID NOT NULL REFERENCES public.iso26000_diagnostics(id) ON DELETE CASCADE,
  action_key    TEXT NOT NULL,  -- ex: 'DA1.1_0', 'DA2.3_4'
  content       TEXT,
  sections      JSONB,          -- NoteSection[] Tiptap
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnostic_id, action_key)
);

ALTER TABLE public.iso26000_action_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY iso26000_notes_access ON public.iso26000_action_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.iso26000_diagnostics d
      WHERE d.id = diagnostic_id
        AND (d.user_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.iso26000_diagnostic_shares s
                        WHERE s.diagnostic_id = d.id AND s.shared_with_user_id = auth.uid()))
    )
  );

-- Pièces jointes SharePoint (zéro transit Vercel/Supabase)
CREATE TABLE IF NOT EXISTS public.iso26000_attachments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id       UUID NOT NULL REFERENCES public.iso26000_diagnostics(id) ON DELETE CASCADE,
  action_key          TEXT NOT NULL,
  name                TEXT NOT NULL,  -- avec préfixe A001_
  sharepoint_item_id  TEXT NOT NULL,
  mime                TEXT,
  size                INTEGER,
  annexe_index        INTEGER,        -- numéro atomique pour le préfixe
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.iso26000_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY iso26000_attach_access ON public.iso26000_attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.iso26000_diagnostics d
      WHERE d.id = diagnostic_id
        AND (d.user_id = auth.uid()
             OR EXISTS (SELECT 1 FROM public.iso26000_diagnostic_shares s
                        WHERE s.diagnostic_id = d.id AND s.shared_with_user_id = auth.uid()))
    )
  );

-- Fonction atomique pour les préfixes A001_
CREATE OR REPLACE FUNCTION public.increment_iso26000_attachment_counter(p_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER AS $$
  UPDATE public.iso26000_diagnostics
  SET attachment_counter = attachment_counter + 1
  WHERE id = p_id
  RETURNING attachment_counter;
$$;
