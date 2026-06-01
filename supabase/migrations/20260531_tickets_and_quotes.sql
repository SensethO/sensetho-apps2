-- ─────────────────────────────────────────────────────────────────────────────
-- tickets — support / reset mdp / mot de passe oublié
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  type        TEXT        NOT NULL DEFAULT 'support'
                CHECK (type IN ('support', 'password_reset', 'forgot_password')),
  subject     TEXT        NOT NULL,
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'open'
                CHECK (status IN ('open', 'in_progress', 'closed')),
  priority    TEXT        NOT NULL DEFAULT 'normal'
                CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tickets_status   ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_user_id  ON public.tickets(user_id);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- Admins voient tout (service role contourne RLS)
-- Utilisateurs connectés voient leurs propres tickets
CREATE POLICY "Users see own tickets"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion publique (tickets anonymes autorisés)
CREATE POLICY "Anyone can create ticket"
  ON public.tickets FOR INSERT
  WITH CHECK (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- app_quotes — demandes d'accès / devis par application
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.app_quotes (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  app_id      UUID        REFERENCES public.apps(id) ON DELETE SET NULL,
  email       TEXT        NOT NULL,
  company     TEXT,
  users_count INTEGER,
  message     TEXT,
  status      TEXT        NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'processing', 'accepted', 'rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_quotes_status ON public.app_quotes(status);
CREATE INDEX IF NOT EXISTS idx_app_quotes_app_id ON public.app_quotes(app_id);

ALTER TABLE public.app_quotes ENABLE ROW LEVEL SECURITY;

-- Admins voient tout via service role (createAdminClient contourne RLS)
-- Pas de lecture publique — gestion admin uniquement
-- Insertion publique (formulaire de demande d'accès)
CREATE POLICY "Anyone can request quote"
  ON public.app_quotes FOR INSERT
  WITH CHECK (true);
