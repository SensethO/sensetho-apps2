-- Correctif : récursion infinie RLS entre plantations ↔ acces_acheteurs
-- La policy plantations_select référençait acces_acheteurs,
-- et acces_acheteurs_select (ancienne version) référençait plantations → boucle.
--
-- Solution : fonction SECURITY DEFINER qui vérifie l'accès acheteur
-- sans déclencher RLS sur acces_acheteurs.

CREATE OR REPLACE FUNCTION public.user_has_plantation_access(p_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM   acces_acheteurs a
    WHERE  a.plantation_id       = p_id
    AND    a.acheteur_user_id    = auth.uid()
  )
$$;

-- Recréer la policy plantations_select sans sous-requête circulaire
DROP POLICY IF EXISTS plantations_select ON public.plantations;

CREATE POLICY plantations_select ON public.plantations
  FOR SELECT
  USING (
    user_id = auth.uid()
    OR public.user_has_plantation_access(id)
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND   profiles.role = 'admin'
    )
  );

-- Vérification
SELECT policyname, qual FROM pg_policies WHERE tablename = 'plantations' AND cmd = 'SELECT';
