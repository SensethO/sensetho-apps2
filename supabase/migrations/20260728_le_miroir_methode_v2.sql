-- ════════════════════════════════════════════════════════════════════════════
-- Le Miroir v2 — alignement sur la Méthode d'accompagnement Sens'ethO v0.6
-- (corpus : Methode_Accompagnement.md)
--
-- Apporte :
--   1. Phases de campagne : statut 'collecte' → 'restitution' (le dirigeant ne
--      lit rien pendant la collecte ; il clôt quand son portrait est fait).
--   2. Contrat de règles : acceptation obligatoire par chaque participant.
--   3. Double portrait de l'entreprise : un animal du MARCHÉ + un animal de la
--      CITÉ (potentiellement totalement différents) → espece_cite_id.
--   4. Cascade complète : postes d'encadrement (le poste, jamais la personne)
--      et parties prenantes externes peintes par les équipes → le_miroir_etres.
--   5. Trame 4.2 bis : signaux (peur / blessure / angle mort) + dédicace.
--   6. Relations aux parties prenantes (symbiose … parasitisme) → relation.
--   7. Phase 4 : image cible (campagne) + 3 engagements observables.
--
-- Idempotent. À exécuter via la Supabase Management API (ref ketnixnfrbpdpduypfbv).
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. Campagnes : statut + image cible ─────────────────────────────────────
ALTER TABLE public.le_miroir_campagnes
  ADD COLUMN IF NOT EXISTS statut TEXT NOT NULL DEFAULT 'collecte' CHECK (statut IN ('collecte','restitution')),
  ADD COLUMN IF NOT EXISTS image_cible JSONB;

-- ─── 2. Participants : acceptation du contrat de règles ──────────────────────
ALTER TABLE public.le_miroir_participants
  ADD COLUMN IF NOT EXISTS regles_acceptees BOOLEAN NOT NULL DEFAULT FALSE;

-- ─── 3-6. Portraits : cascade, double animal, signaux, dédicace, relation ────
ALTER TABLE public.le_miroir_portraits
  ADD COLUMN IF NOT EXISTS espece_cite_id TEXT,   -- animal de la cité (entreprise ; NULL sinon)
  ADD COLUMN IF NOT EXISTS milieu_libre  TEXT,    -- services/postes : le milieu décrit en mots
  ADD COLUMN IF NOT EXISTS relation      TEXT,    -- parties prenantes : symbiose…parasitisme
  ADD COLUMN IF NOT EXISTS signaux       TEXT,    -- peur / blessure / angle mort
  ADD COLUMN IF NOT EXISTS dedicace      TEXT;    -- « si l'animal pouvait dire une chose au dirigeant »

-- Les portraits de services/postes/parties prenantes n'ont qu'un seul milieu :
ALTER TABLE public.le_miroir_portraits ALTER COLUMN habitat_marche_id DROP NOT NULL;
ALTER TABLE public.le_miroir_portraits ALTER COLUMN habitat_cite_id  DROP NOT NULL;
ALTER TABLE public.le_miroir_portraits ALTER COLUMN verdict_marche   DROP NOT NULL;
ALTER TABLE public.le_miroir_portraits ALTER COLUMN verdict_cite     DROP NOT NULL;

-- ─── 4. Êtres déclarés au cadrage (postes d'encadrement, parties prenantes) ──
CREATE TABLE IF NOT EXISTS public.le_miroir_etres (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id  UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL CHECK (kind IN ('poste','partie_prenante')),
  label        TEXT NOT NULL,
  cote         TEXT CHECK (cote IN ('marche','cite','groupe')),  -- parties prenantes : quel milieu peuplent-elles ?
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS le_miroir_etres_campagne_idx ON public.le_miroir_etres(campagne_id);

-- ─── 7. Engagements (phase 4 — 3 max, comportements observables) ─────────────
CREATE TABLE IF NOT EXISTS public.le_miroir_engagements (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  campagne_id   UUID NOT NULL REFERENCES public.le_miroir_campagnes(id) ON DELETE CASCADE,
  qui           TEXT NOT NULL,
  quoi          TEXT NOT NULL,
  echeance      TEXT,
  comportement  TEXT NOT NULL,   -- le comportement observable qui prouvera le changement
  statut        TEXT NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours','constate','abandonne')),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS le_miroir_engagements_campagne_idx ON public.le_miroir_engagements(campagne_id);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.le_miroir_etres        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.le_miroir_engagements  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS le_miroir_etres_read  ON public.le_miroir_etres;
CREATE POLICY le_miroir_etres_read ON public.le_miroir_etres
  FOR SELECT USING (public.le_miroir_can_access(campagne_id));
DROP POLICY IF EXISTS le_miroir_etres_write ON public.le_miroir_etres;
CREATE POLICY le_miroir_etres_write ON public.le_miroir_etres
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

DROP POLICY IF EXISTS le_miroir_engagements_read  ON public.le_miroir_engagements;
CREATE POLICY le_miroir_engagements_read ON public.le_miroir_engagements
  FOR SELECT USING (public.le_miroir_can_access(campagne_id));
DROP POLICY IF EXISTS le_miroir_engagements_write ON public.le_miroir_engagements;
CREATE POLICY le_miroir_engagements_write ON public.le_miroir_engagements
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM public.le_miroir_campagnes c WHERE c.id = campagne_id AND c.owner_id = auth.uid())
  );

-- ─── Description de l'app dans le catalogue ──────────────────────────────────
UPDATE public.apps SET description =
  'Le miroir collectif de la méthode Sens''ethO : l''entreprise (deux animaux — marché et cité), ses services, ses postes d''encadrement et ses parties prenantes, peints par les équipes. Écarts de perception, adéquation animal-milieu, image cible et engagements observables.'
WHERE slug = 'le-miroir';
