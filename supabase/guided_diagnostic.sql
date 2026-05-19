-- ── guided_diagnostics ────────────────────────────────────────────────────────
-- Une ligne par (user_id, organisation_id, year) — créée automatiquement à la
-- première ouverture de l'app pour cette organisation et cette année.

CREATE TABLE IF NOT EXISTS public.guided_diagnostics (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id     UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  year                INTEGER NOT NULL,
  secteur             TEXT,
  scores              JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_progress     JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_na           JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis         TEXT,
  ai_scores           JSONB,
  ai_generated_at     TIMESTAMPTZ,
  -- Compteur monotone pour la génération des préfixes d'annexes (A001_, A002_…).
  -- Incrémenté atomiquement via increment_attachment_counter() à chaque upload.
  -- Ne jamais réinitialiser : garantit l'unicité même après suppression d'annexes.
  attachment_counter  INTEGER NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, organisation_id, year)
);

CREATE INDEX IF NOT EXISTS guided_diagnostics_user_idx ON public.guided_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS guided_diagnostics_org_idx  ON public.guided_diagnostics(organisation_id);

DROP TRIGGER IF EXISTS guided_diagnostics_updated_at ON public.guided_diagnostics;
CREATE TRIGGER guided_diagnostics_updated_at
  BEFORE UPDATE ON public.guided_diagnostics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── guided_action_notes ───────────────────────────────────────────────────────
-- Notes libres par action, rattachées au diagnostic

CREATE TABLE IF NOT EXISTS public.guided_action_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id   UUID NOT NULL REFERENCES public.guided_diagnostics(id) ON DELETE CASCADE,
  action_key      TEXT NOT NULL,   -- ex: 'DA1.1_0', 'DA3.4_2'
  content         TEXT NOT NULL DEFAULT '',
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnostic_id, action_key)
);

CREATE INDEX IF NOT EXISTS guided_action_notes_diag_idx ON public.guided_action_notes(diagnostic_id);

DROP TRIGGER IF EXISTS guided_action_notes_updated_at ON public.guided_action_notes;
CREATE TRIGGER guided_action_notes_updated_at
  BEFORE UPDATE ON public.guided_action_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── guided_diagnostic_shares ──────────────────────────────────────────────────
-- Partage d'un diagnostic avec un autre utilisateur abonné

CREATE TABLE IF NOT EXISTS public.guided_diagnostic_shares (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diagnostic_id         UUID NOT NULL REFERENCES public.guided_diagnostics(id) ON DELETE CASCADE,
  shared_with_user_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission            TEXT NOT NULL DEFAULT 'read' CHECK (permission IN ('read', 'edit')),
  shared_by             UUID NOT NULL REFERENCES auth.users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnostic_id, shared_with_user_id)
);

CREATE INDEX IF NOT EXISTS guided_shares_diag_idx ON public.guided_diagnostic_shares(diagnostic_id);
CREATE INDEX IF NOT EXISTS guided_shares_with_idx  ON public.guided_diagnostic_shares(shared_with_user_id);

-- ── RLS guided_diagnostics ────────────────────────────────────────────────────
ALTER TABLE public.guided_diagnostics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "diag_owner_all"   ON public.guided_diagnostics;
DROP POLICY IF EXISTS "diag_shared_read" ON public.guided_diagnostics;

-- Propriétaire : accès complet
CREATE POLICY "diag_owner_all" ON public.guided_diagnostics
  FOR ALL USING (auth.uid() = user_id);

-- Partagé en lecture
CREATE POLICY "diag_shared_read" ON public.guided_diagnostics
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guided_diagnostic_shares
      WHERE diagnostic_id = id AND shared_with_user_id = auth.uid()
    )
  );

-- ── RLS guided_action_notes ───────────────────────────────────────────────────
ALTER TABLE public.guided_action_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notes_owner_all"   ON public.guided_action_notes;
DROP POLICY IF EXISTS "notes_shared_read" ON public.guided_action_notes;

CREATE POLICY "notes_owner_all" ON public.guided_action_notes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.guided_diagnostics
      WHERE id = diagnostic_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "notes_shared_read" ON public.guided_action_notes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.guided_diagnostic_shares
      WHERE diagnostic_id = guided_action_notes.diagnostic_id
        AND shared_with_user_id = auth.uid()
    )
  );

-- ── RLS guided_diagnostic_shares ──────────────────────────────────────────────
ALTER TABLE public.guided_diagnostic_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shares_owner"    ON public.guided_diagnostic_shares;
DROP POLICY IF EXISTS "shares_as_guest" ON public.guided_diagnostic_shares;

-- Seul le propriétaire peut gérer les partages
CREATE POLICY "shares_owner" ON public.guided_diagnostic_shares
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.guided_diagnostics
      WHERE id = diagnostic_id AND user_id = auth.uid()
    )
  );

-- Un utilisateur partagé peut voir son propre partage
CREATE POLICY "shares_as_guest" ON public.guided_diagnostic_shares
  FOR SELECT USING (shared_with_user_id = auth.uid());

-- ── Fonction : incrémenter le compteur d'annexes (atomique) ──────────────────
-- Retourne la nouvelle valeur du compteur (utilisée comme index du préfixe A001_).
-- SECURITY DEFINER : appelée avec les droits du service role depuis les API routes.
-- Ne jamais appeler directement côté client.
CREATE OR REPLACE FUNCTION public.increment_attachment_counter(p_id uuid)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.guided_diagnostics
  SET attachment_counter = attachment_counter + 1
  WHERE id = p_id
  RETURNING attachment_counter;
$$;

-- ── Fonction utilitaire : vérifier un abonnement actif ────────────────────────
CREATE OR REPLACE FUNCTION public.has_app_subscription(p_app_slug TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.app_subscriptions s
    JOIN public.apps a ON a.id = s.app_id
    WHERE s.user_id = auth.uid()
      AND a.slug = p_app_slug
      AND s.status = 'active'
      AND (s.expires_at IS NULL OR s.expires_at > NOW())
  );
$$;
