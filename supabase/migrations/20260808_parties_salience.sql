-- Module Parties prenantes de Projet RSE — enrichissement d'après le cours
-- « MdGP - Les parties prenantes » (PMBOK 7 + modèle de Salience Mitchell/Agle/Wood
-- 1997 + matrice d'évaluation de l'engagement C/D) :
-- légitimité et urgence (salience P/L/U → 7 groupes), niveaux d'engagement
-- courant/désiré (peu conscient → leader), mode de communication push/pull/interactif.

ALTER TABLE projet_rse_parties
  ADD COLUMN IF NOT EXISTS legitimite int NOT NULL DEFAULT 3 CHECK (legitimite BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS urgence int NOT NULL DEFAULT 1 CHECK (urgence BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS engagement_actuel text NOT NULL DEFAULT 'peu_conscient'
    CHECK (engagement_actuel IN ('peu_conscient','resistant','neutre','solidaire','leader')),
  ADD COLUMN IF NOT EXISTS engagement_souhaite text NOT NULL DEFAULT 'solidaire'
    CHECK (engagement_souhaite IN ('peu_conscient','resistant','neutre','solidaire','leader'));

ALTER TABLE projet_rse_engagements
  ADD COLUMN IF NOT EXISTS mode text CHECK (mode IN ('push','pull','interactive'));

-- ROLLBACK :
-- ALTER TABLE projet_rse_parties DROP COLUMN IF EXISTS legitimite, DROP COLUMN IF EXISTS urgence,
--   DROP COLUMN IF EXISTS engagement_actuel, DROP COLUMN IF EXISTS engagement_souhaite;
-- ALTER TABLE projet_rse_engagements DROP COLUMN IF EXISTS mode;
