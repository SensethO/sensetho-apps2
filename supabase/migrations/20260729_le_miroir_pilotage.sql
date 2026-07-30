-- ════════════════════════════════════════════════════════════════════════════
-- Le Miroir — dossier de campagne / pilotage par le responsable
--
-- 1. CELLULES nominatives (l'unité d'observation de la méthode, §3.3) :
--    le responsable crée les cellules et y place les participants.
-- 2. SOCLE d'êtres imposés (+ libre au-delà) : garantit le seuil sur l'essentiel.
-- 3. INVITATIONS par lien anonyme (token) : participer sans compte plateforme —
--    indispensable en mission réelle et pour les parties prenantes externes.
--    Les participants anonymes n'ont pas de user_id : leur écriture passe
--    exclusivement par des routes API en service_role (RLS jamais contournée
--    côté client).
--
-- Idempotent. À exécuter via la Supabase Management API (ref ketnixnfrbpdpduypfbv).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Cellules ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.le_miroir_cellules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  nom         TEXT NOT NULL,
  perimetre   TEXT,               -- service, site, métier… (le point de vue commun)
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS le_miroir_cellules_campagne_idx ON public.le_miroir_cellules(campagne_id);

-- ─── 2. Participants : rattachement à une cellule + participants sans compte ──
ALTER TABLE public.le_miroir_participants
  ADD COLUMN IF NOT EXISTS cellule_id UUID REFERENCES public.le_miroir_cellules(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nom        TEXT,     -- libellé pour un participant sans compte
  ADD COLUMN IF NOT EXISTS is_externe BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.le_miroir_participants ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS le_miroir_participants_cellule_idx ON public.le_miroir_participants(cellule_id);

-- ─── 3. Invitations par lien (token) ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.le_miroir_invitations (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id    UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  cellule_id     UUID REFERENCES public.le_miroir_cellules(id) ON DELETE SET NULL,
  token          TEXT NOT NULL UNIQUE,
  label          TEXT,                                     -- « Atelier 1 », « Client A »…
  kind           TEXT NOT NULL DEFAULT 'interne' CHECK (kind IN ('interne','externe')),
  cote           TEXT CHECK (cote IN ('marche','cite','groupe')),  -- parties prenantes externes
  participant_id UUID REFERENCES public.le_miroir_participants(id) ON DELETE SET NULL,
  revoked        BOOLEAN NOT NULL DEFAULT FALSE,
  used_at        TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS le_miroir_invitations_campagne_idx ON public.le_miroir_invitations(campagne_id);
CREATE INDEX IF NOT EXISTS le_miroir_invitations_token_idx    ON public.le_miroir_invitations(token);

-- ─── 4. Portraits : auteur identifié par participant (compte OU anonyme) ──────
ALTER TABLE public.le_miroir_portraits
  ADD COLUMN IF NOT EXISTS participant_id UUID REFERENCES public.le_miroir_participants(id) ON DELETE SET NULL;
ALTER TABLE public.le_miroir_portraits ALTER COLUMN user_id DROP NOT NULL;
CREATE INDEX IF NOT EXISTS le_miroir_portraits_participant_idx ON public.le_miroir_portraits(participant_id);

-- Backfill : rattacher les portraits existants à leur participant (comptage uniforme)
UPDATE public.le_miroir_portraits p
   SET participant_id = pa.id
  FROM public.le_miroir_participants pa
 WHERE pa.campagne_id = p.campagne_id
   AND pa.user_id = p.user_id
   AND p.participant_id IS NULL;

-- ─── 5. Campagne : socle d'êtres imposés + calendrier ─────────────────────────
ALTER TABLE public.le_miroir_campagnes
  ADD COLUMN IF NOT EXISTS socle               JSONB,   -- { etres: [etre_key], son_service: bool }
  ADD COLUMN IF NOT EXISTS date_cloture_prevue DATE;

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.le_miroir_cellules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.le_miroir_invitations  ENABLE ROW LEVEL SECURITY;

-- Cellules : lisibles par tout participant de la campagne, gérées par le responsable
DROP POLICY IF EXISTS le_miroir_cellules_read ON public.le_miroir_cellules;
CREATE POLICY le_miroir_cellules_read ON public.le_miroir_cellules
  FOR SELECT USING (public.le_miroir_can_access(campagne_id));
DROP POLICY IF EXISTS le_miroir_cellules_write ON public.le_miroir_cellules;
CREATE POLICY le_miroir_cellules_write ON public.le_miroir_cellules
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

-- Invitations : RÉSERVÉES au responsable (un token ne doit jamais fuiter à un
-- autre participant). L'accès anonyme se fait uniquement par route API service_role.
DROP POLICY IF EXISTS le_miroir_invitations_owner ON public.le_miroir_invitations;
CREATE POLICY le_miroir_invitations_owner ON public.le_miroir_invitations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

-- Le responsable doit pouvoir rattacher/déplacer les participants dans les cellules
DROP POLICY IF EXISTS le_miroir_participants_owner_update ON public.le_miroir_participants;
CREATE POLICY le_miroir_participants_owner_update ON public.le_miroir_participants
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

-- …et pouvoir retirer un participant de sa campagne
DROP POLICY IF EXISTS le_miroir_participants_owner_delete ON public.le_miroir_participants;
CREATE POLICY le_miroir_participants_owner_delete ON public.le_miroir_participants
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );
