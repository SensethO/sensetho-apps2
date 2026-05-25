-- ============================================================
-- VSME Notes & Documents — tables pour GuidedActionNotePanel
-- ============================================================

-- Notes Tiptap par datapoint
CREATE TABLE IF NOT EXISTS public.vsme_notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vsme_id     UUID NOT NULL REFERENCES public.vsme_settings(id) ON DELETE CASCADE,
  action_key  TEXT NOT NULL,
  content     TEXT NOT NULL DEFAULT '',
  sections    JSONB NOT NULL DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(vsme_id, action_key)
);

CREATE INDEX IF NOT EXISTS vsme_notes_vsme_id ON public.vsme_notes (vsme_id);

ALTER TABLE public.vsme_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsme_notes_authenticated
  ON public.vsme_notes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_vsme_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE TRIGGER vsme_notes_updated_at
  BEFORE UPDATE ON public.vsme_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_vsme_notes_updated_at();

-- Pièces jointes SharePoint
CREATE TABLE IF NOT EXISTS public.vsme_attachments (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  vsme_id             UUID NOT NULL REFERENCES public.vsme_settings(id) ON DELETE CASCADE,
  action_key          TEXT NOT NULL,
  name                TEXT NOT NULL,
  sharepoint_item_id  TEXT NOT NULL,
  mime                TEXT,
  size                BIGINT,
  annexe_index        INTEGER,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vsme_attachments_vsme_id ON public.vsme_attachments (vsme_id);

ALTER TABLE public.vsme_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY vsme_attachments_authenticated
  ON public.vsme_attachments FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Compteur atomique pour préfixes A001_
ALTER TABLE public.vsme_settings
  ADD COLUMN IF NOT EXISTS attachment_counter INTEGER NOT NULL DEFAULT 0;

-- RPC atomique
CREATE OR REPLACE FUNCTION public.increment_vsme_attachment_counter(p_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_counter integer;
BEGIN
  UPDATE public.vsme_settings
  SET attachment_counter = attachment_counter + 1
  WHERE id = p_id
  RETURNING attachment_counter INTO v_counter;
  RETURN v_counter;
END; $$;
