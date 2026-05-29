-- Table pour sauvegarder les simulations / analyses IA par app et par utilisateur
-- À exécuter dans le SQL Editor de Supabase (projet ketnixnfrbpdpduypfbv)

CREATE TABLE IF NOT EXISTS public.saved_simulations (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  app_id      TEXT        NOT NULL,
  name        TEXT        NOT NULL,
  year        INTEGER,
  data        JSONB       NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_simulations_user_app
  ON public.saved_simulations(user_id, app_id);

CREATE INDEX IF NOT EXISTS idx_saved_simulations_app_name
  ON public.saved_simulations(app_id, name);

ALTER TABLE public.saved_simulations ENABLE ROW LEVEL SECURITY;

-- Les utilisateurs voient et gèrent leurs propres simulations
CREATE POLICY "Users manage their own simulations"
  ON public.saved_simulations
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Les admins voient tout (via service role — contourne RLS, pas besoin de policy supplémentaire)
-- Note : les API routes utilisent createAdminClient() qui contourne RLS automatiquement.
