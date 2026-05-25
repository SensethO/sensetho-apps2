-- ============================================================
-- Parties Prenantes & Matérialité
-- Sessions, notes, invitations pour l'engagement CSRD/ESRS
-- ============================================================

-- ─── Table principale des sessions ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pp_sessions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  organisation      TEXT,
  secteur           TEXT,
  exercice          TEXT NOT NULL DEFAULT EXTRACT(year FROM NOW())::text,
  mode              TEXT NOT NULL DEFAULT 'csrd'
                      CHECK (mode IN ('voluntaire', 'csrd', 'both')),
  materiality_type  TEXT NOT NULL DEFAULT 'double'
                      CHECK (materiality_type IN ('simple', 'double')),
  status            TEXT NOT NULL DEFAULT 'actif'
                      CHECK (status IN ('actif', 'archivé')),
  stakeholders      JSONB NOT NULL DEFAULT '[]',
  surveys           JSONB NOT NULL DEFAULT '[]',
  materiality_scores JSONB NOT NULL DEFAULT '[]',
  session_notes     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pp_sessions_user_id
  ON public.pp_sessions (user_id);

ALTER TABLE public.pp_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_sessions_owner
  ON public.pp_sessions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.update_pp_sessions_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pp_sessions_updated_at
  BEFORE UPDATE ON public.pp_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_pp_sessions_updated_at();

-- ─── Table des notes de session ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pp_session_notes (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id  UUID NOT NULL REFERENCES public.pp_sessions(id) ON DELETE CASCADE,
  note_key    TEXT NOT NULL,
  content     TEXT DEFAULT '',
  sections    JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, note_key)
);

CREATE INDEX IF NOT EXISTS pp_session_notes_session_id
  ON public.pp_session_notes (session_id);

ALTER TABLE public.pp_session_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_session_notes_owner
  ON public.pp_session_notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pp_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pp_sessions s
      WHERE s.id = session_id AND s.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.update_pp_session_notes_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER pp_session_notes_updated_at
  BEFORE UPDATE ON public.pp_session_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_pp_session_notes_updated_at();

-- ─── Table des invitations aux enquêtes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.pp_survey_invites (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id    UUID NOT NULL REFERENCES public.pp_sessions(id) ON DELETE CASCADE,
  survey_id     TEXT NOT NULL,
  email         TEXT NOT NULL,
  token         TEXT NOT NULL,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  opened_at     TIMESTAMPTZ,
  clicked_at    TIMESTAMPTZ,
  responded_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS pp_survey_invites_session_survey
  ON public.pp_survey_invites (session_id, survey_id);

ALTER TABLE public.pp_survey_invites ENABLE ROW LEVEL SECURITY;

-- Les invitations sont gérées par le service role (admin client) uniquement
CREATE POLICY pp_survey_invites_service
  ON public.pp_survey_invites
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
