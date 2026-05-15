-- ── 1. Champs de tarification sur les apps ────────────────────────────────────
ALTER TABLE public.apps
  ADD COLUMN IF NOT EXISTS pricing_type TEXT NOT NULL DEFAULT 'free'
    CHECK (pricing_type IN ('free', 'subscription', 'perpetual', 'quote')),
  ADD COLUMN IF NOT EXISTS price_monthly NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS price_annual NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS annual_discount_pct INTEGER DEFAULT 0
    CHECK (annual_discount_pct >= 0 AND annual_discount_pct <= 100),
  ADD COLUMN IF NOT EXISTS price_perpetual NUMERIC(10,2);

-- ── 2. Abonnements utilisateurs ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  app_id      UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  plan        TEXT NOT NULL CHECK (plan IN ('monthly', 'annual', 'perpetual')),
  status      TEXT NOT NULL DEFAULT 'active'
              CHECK (status IN ('active', 'cancelled', 'expired')),
  price_paid  NUMERIC(10,2),
  notes       TEXT,
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_subscriptions' AND policyname='sub_own_read') THEN
    CREATE POLICY "sub_own_read" ON public.app_subscriptions
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "sub_admin_all" ON public.app_subscriptions
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_app_subscriptions_updated_at') THEN
    CREATE TRIGGER set_app_subscriptions_updated_at
      BEFORE UPDATE ON public.app_subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 3. Demandes de devis ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_quotes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  app_id      UUID NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  company     TEXT,
  users_count INTEGER,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'processing', 'accepted', 'rejected')),
  admin_notes TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.app_quotes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='app_quotes' AND policyname='quote_own_view') THEN
    CREATE POLICY "quote_own_view" ON public.app_quotes
      FOR SELECT USING (auth.uid() = user_id);
    CREATE POLICY "quote_anon_create" ON public.app_quotes
      FOR INSERT WITH CHECK (true);
    CREATE POLICY "quote_admin_all" ON public.app_quotes
      FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
      );
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='set_app_quotes_updated_at') THEN
    CREATE TRIGGER set_app_quotes_updated_at
      BEFORE UPDATE ON public.app_quotes
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;

-- ── 4. Nouvelles apps admin ──────────────────────────────────────────────────
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active, is_admin_only)
SELECT 'Abonnements', 'admin-subscriptions', 'Gérer les abonnements utilisateurs',
  'creditCard', '/admin/subscriptions',
  (SELECT id FROM public.app_categories WHERE slug = 'administration' LIMIT 1),
  4, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.apps WHERE slug = 'admin-subscriptions');

INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active, is_admin_only)
SELECT 'Devis', 'admin-quotes', 'Gérer les demandes de devis',
  'fileText', '/admin/quotes',
  (SELECT id FROM public.app_categories WHERE slug = 'administration' LIMIT 1),
  5, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.apps WHERE slug = 'admin-quotes');
