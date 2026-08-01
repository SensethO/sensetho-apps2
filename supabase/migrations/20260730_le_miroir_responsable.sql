-- ════════════════════════════════════════════════════════════════════════════
-- Le Miroir — le responsable de campagne est désigné par un ADMINISTRATEUR
--
-- Règle : le Pilotage (cellules, socle, liens d'invitation, clôture) n'est
-- visible et modifiable que par le responsable validé, ou par un administrateur.
-- Créer une campagne ne confère PAS ce droit : seul un administrateur du site
-- peut valider un utilisateur comme responsable.
--
-- Le verrou est posé en base (déclencheur), pas seulement dans l'interface :
-- même en appelant l'API directement, un non-administrateur ne peut pas
-- s'auto-désigner.
--
-- Idempotent. Supabase Management API (ref ketnixnfrbpdpduypfbv).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.le_miroir_campagnes
  ADD COLUMN IF NOT EXISTS responsable_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_valide_par UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS responsable_valide_le  TIMESTAMPTZ;

-- Continuité : les campagnes existantes gardent leur créateur comme responsable,
-- validé par l'administrateur qui exécute cette migration.
UPDATE public.le_miroir_campagnes
   SET responsable_id = owner_id,
       responsable_valide_le = NOW()
 WHERE responsable_id IS NULL;

-- ─── Helpers ──────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.le_miroir_is_admin(uid UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = uid AND p.role = 'admin');
$$;

/** Droit de piloter : responsable validé de la campagne, ou administrateur. */
CREATE OR REPLACE FUNCTION public.le_miroir_peut_piloter(c_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.le_miroir_campagnes c
     WHERE c.id = c_id
       AND (c.responsable_id = auth.uid() OR public.le_miroir_is_admin(auth.uid()))
  );
$$;

-- ─── Verrou : seul un administrateur désigne le responsable ───────────────────
CREATE OR REPLACE FUNCTION public.le_miroir_guard_responsable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id THEN
    IF auth.uid() IS NULL OR NOT public.le_miroir_is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Seul un administrateur du site peut désigner le responsable de la campagne';
    END IF;
    NEW.responsable_valide_par := auth.uid();
    NEW.responsable_valide_le  := NOW();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS le_miroir_guard_responsable_trg ON public.le_miroir_campagnes;
CREATE TRIGGER le_miroir_guard_responsable_trg
  BEFORE UPDATE ON public.le_miroir_campagnes
  FOR EACH ROW EXECUTE FUNCTION public.le_miroir_guard_responsable();

-- ─── Accès en lecture : le responsable voit la campagne ───────────────────────
CREATE OR REPLACE FUNCTION public.le_miroir_can_access(c_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.le_miroir_campagnes c
    WHERE c.id = c_id AND (
      c.owner_id = auth.uid()
      OR c.responsable_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.le_miroir_campagne_shares s
                 WHERE s.campagne_id = c.id AND s.shared_with_user_id = auth.uid())
      OR public.le_miroir_is_admin(auth.uid())
    )
  );
$$;

-- ─── Écritures de pilotage réservées au responsable validé ────────────────────
DROP POLICY IF EXISTS le_miroir_campagnes_update ON public.le_miroir_campagnes;
CREATE POLICY le_miroir_campagnes_update ON public.le_miroir_campagnes
  FOR UPDATE USING (public.le_miroir_peut_piloter(id));

DROP POLICY IF EXISTS le_miroir_cellules_write ON public.le_miroir_cellules;
CREATE POLICY le_miroir_cellules_write ON public.le_miroir_cellules
  FOR ALL USING (public.le_miroir_peut_piloter(campagne_id))
  WITH CHECK (public.le_miroir_peut_piloter(campagne_id));

DROP POLICY IF EXISTS le_miroir_etres_write ON public.le_miroir_etres;
CREATE POLICY le_miroir_etres_write ON public.le_miroir_etres
  FOR ALL USING (public.le_miroir_peut_piloter(campagne_id))
  WITH CHECK (public.le_miroir_peut_piloter(campagne_id));

DROP POLICY IF EXISTS le_miroir_engagements_write ON public.le_miroir_engagements;
CREATE POLICY le_miroir_engagements_write ON public.le_miroir_engagements
  FOR ALL USING (public.le_miroir_peut_piloter(campagne_id))
  WITH CHECK (public.le_miroir_peut_piloter(campagne_id));

DROP POLICY IF EXISTS le_miroir_invitations_owner ON public.le_miroir_invitations;
CREATE POLICY le_miroir_invitations_owner ON public.le_miroir_invitations
  FOR ALL USING (public.le_miroir_peut_piloter(campagne_id))
  WITH CHECK (public.le_miroir_peut_piloter(campagne_id));

DROP POLICY IF EXISTS le_miroir_participants_owner_update ON public.le_miroir_participants;
CREATE POLICY le_miroir_participants_owner_update ON public.le_miroir_participants
  FOR UPDATE USING (public.le_miroir_peut_piloter(campagne_id))
  WITH CHECK (public.le_miroir_peut_piloter(campagne_id));

DROP POLICY IF EXISTS le_miroir_participants_owner_delete ON public.le_miroir_participants;
CREATE POLICY le_miroir_participants_owner_delete ON public.le_miroir_participants
  FOR DELETE USING (public.le_miroir_peut_piloter(campagne_id));
-- Le verrou doit aussi couvrir l'INSERT : sans cela, un utilisateur pourrait
-- créer une campagne en se désignant lui-même responsable.
CREATE OR REPLACE FUNCTION public.le_miroir_guard_responsable()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.responsable_id IS NOT NULL
       AND (auth.uid() IS NULL OR NOT public.le_miroir_is_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Seul un administrateur du site peut désigner le responsable de la campagne';
    END IF;
    IF NEW.responsable_id IS NOT NULL THEN
      NEW.responsable_valide_par := auth.uid();
      NEW.responsable_valide_le  := NOW();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.responsable_id IS DISTINCT FROM OLD.responsable_id THEN
    IF auth.uid() IS NULL OR NOT public.le_miroir_is_admin(auth.uid()) THEN
      RAISE EXCEPTION 'Seul un administrateur du site peut désigner le responsable de la campagne';
    END IF;
    NEW.responsable_valide_par := auth.uid();
    NEW.responsable_valide_le  := NOW();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS le_miroir_guard_responsable_trg ON public.le_miroir_campagnes;
CREATE TRIGGER le_miroir_guard_responsable_trg
  BEFORE INSERT OR UPDATE ON public.le_miroir_campagnes
  FOR EACH ROW EXECUTE FUNCTION public.le_miroir_guard_responsable();
