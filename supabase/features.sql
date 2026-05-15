-- ── 1. must_change_password sur profiles ────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. User Preferences ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
  user_id    UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  theme      TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='user_preferences' AND policyname='user_prefs_own') THEN
    CREATE POLICY "user_prefs_own" ON public.user_preferences
      FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_user_preferences_updated_at') THEN
    CREATE TRIGGER set_user_preferences_updated_at
      BEFORE UPDATE ON public.user_preferences
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 3. Tickets ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tickets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email       TEXT,
  type        TEXT NOT NULL DEFAULT 'support'
    CHECK (type IN ('support', 'password_reset', 'forgot_password')),
  subject     TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'closed')),
  priority    TEXT NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tickets' AND policyname='tickets_own_view') THEN
    CREATE POLICY "tickets_own_view" ON public.tickets
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "tickets_own_create" ON public.tickets
      FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
    CREATE POLICY "tickets_admin" ON public.tickets
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_tickets_updated_at') THEN
    CREATE TRIGGER set_tickets_updated_at
      BEFORE UPDATE ON public.tickets
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 4. App Tickets dans la catégorie Administration ───────────────────────────
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active, is_admin_only)
SELECT
  'Tickets support',
  'admin-tickets',
  'Gestion des tickets utilisateurs',
  'ticket',
  '/admin/tickets',
  (SELECT id FROM public.app_categories WHERE slug = 'administration' LIMIT 1),
  3,
  true,
  true
WHERE NOT EXISTS (SELECT 1 FROM public.apps WHERE slug = 'admin-tickets');
