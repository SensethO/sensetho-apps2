-- ============================================================
-- Migration : Notes & Documents pour les actions Gestion du Temps
-- Table : gt_action_notes (1 row per action)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.gt_action_notes (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id           uuid        NOT NULL UNIQUE REFERENCES public.gt_actions(id) ON DELETE CASCADE,
  content             text        NOT NULL DEFAULT '',
  sections            jsonb       NOT NULL DEFAULT '[]',
  attachment_counter  int         NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gt_action_notes_action_idx ON public.gt_action_notes(action_id);

ALTER TABLE public.gt_action_notes ENABLE ROW LEVEL SECURITY;

-- Lecture : owner ou membre du projet
CREATE POLICY "gt_notes_select" ON public.gt_action_notes
  FOR SELECT TO authenticated
  USING (
    action_id IN (
      SELECT a.id FROM public.gt_actions a
      JOIN public.gt_projects p ON p.id = a.project_id
      WHERE p.owner_id = auth.uid()
         OR p.id IN (SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid())
    )
  );

-- Écriture : owner ou editor
CREATE POLICY "gt_notes_insert" ON public.gt_action_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    action_id IN (
      SELECT a.id FROM public.gt_actions a
      JOIN public.gt_projects p ON p.id = a.project_id
      WHERE p.owner_id = auth.uid()
         OR p.id IN (SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid() AND role = 'editor')
    )
  );

CREATE POLICY "gt_notes_update" ON public.gt_action_notes
  FOR UPDATE TO authenticated
  USING (
    action_id IN (
      SELECT a.id FROM public.gt_actions a
      JOIN public.gt_projects p ON p.id = a.project_id
      WHERE p.owner_id = auth.uid()
         OR p.id IN (SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid() AND role = 'editor')
    )
  );

-- ── Fonction atomique compteur annexes ───────────────────────
CREATE OR REPLACE FUNCTION public.increment_gt_action_notes_counter(p_action_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_counter integer;
BEGIN
  INSERT INTO public.gt_action_notes (action_id, content, sections, attachment_counter)
  VALUES (p_action_id, '', '[]', 1)
  ON CONFLICT (action_id) DO UPDATE
    SET attachment_counter = gt_action_notes.attachment_counter + 1,
        updated_at = now()
  RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END;
$$;

-- ── Realtime ─────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.gt_action_notes;
