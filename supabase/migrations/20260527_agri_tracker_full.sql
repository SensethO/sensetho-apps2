-- ══════════════════════════════════════════════════════════════════════════════
-- AgriTracker — Migration complète (tables + rôles + CRM)
-- À appliquer via : supabase db query --linked < cette-migration.sql
-- ══════════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- 1. TABLES PRINCIPALES
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS plantations (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid        REFERENCES auth.users(id) NOT NULL,
  nom                   text        NOT NULL,
  pays_code             text,
  pays_nom              text,
  region                text,
  ville                 text,
  adresse               text,
  forme_juridique       text,
  numero_registre       text,
  superficie_totale_ha  numeric,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS champs (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id   uuid        REFERENCES plantations(id) ON DELETE CASCADE NOT NULL,
  nom             text        NOT NULL,
  produit_faostat text,
  produit_code    text,
  variete         text,
  superficie_ha   numeric,
  coordonnees     jsonb,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS observations_meteo (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id         uuid        REFERENCES plantations(id) ON DELETE CASCADE NOT NULL,
  champ_id              uuid        REFERENCES champs(id) ON DELETE SET NULL,
  date                  date        NOT NULL,
  periode               text        NOT NULL CHECK (periode IN ('nuit', 'matin', 'apres-midi')),
  temperature_c         numeric,
  humidite_pct          integer,
  precipitation_mm      numeric,
  vent_kmh              numeric,
  vent_direction        text,
  couverture_nuageuse   text        CHECK (couverture_nuageuse IN (
                                      'ciel_clair', 'peu_nuageux', 'partiellement_nuageux',
                                      'nuageux', 'tres_nuageux', 'brouillard'
                                    )),
  commentaire           text,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (plantation_id, date, periode)
);

CREATE TABLE IF NOT EXISTS photos_terrain (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id   uuid        REFERENCES plantations(id) ON DELETE CASCADE NOT NULL,
  champ_id        uuid        REFERENCES champs(id) ON DELETE SET NULL,
  date_prise      date,
  heure_prise     time,
  url_sharepoint  text,
  filename        text,
  latitude        numeric,
  longitude       numeric,
  type_sujet      text        CHECK (type_sujet IN ('fruit', 'plante', 'arbre', 'sol', 'maladie', 'autre')),
  produit         text,
  commentaire     text,
  created_at      timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acces_acheteurs (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  acheteur_user_id    uuid        REFERENCES auth.users(id) NOT NULL,
  plantation_id       uuid        REFERENCES plantations(id) ON DELETE CASCADE NOT NULL,
  invite_par          uuid        REFERENCES auth.users(id),
  created_at          timestamptz DEFAULT now(),
  UNIQUE (acheteur_user_id, plantation_id)
);

-- ─────────────────────────────────────────────
-- 2. RÔLES AGRI (admin-géré)
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agri_user_roles (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role          text        NOT NULL CHECK (role IN ('planteur', 'acheteur')),
  assigned_by   uuid        REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  UNIQUE(user_id, role)
);

-- ─────────────────────────────────────────────
-- 3. CRM
-- ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS agri_crm_messages (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id    uuid        NOT NULL,
  acheteur_user_id uuid,
  sender_user_id   uuid        NOT NULL,
  sender_nom       text,
  content          text        NOT NULL,
  lu_par           uuid[]      DEFAULT '{}',
  attachments      jsonb       DEFAULT '[]',
  created_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agri_crm_messages_plantation_idx ON agri_crm_messages(plantation_id);
CREATE INDEX IF NOT EXISTS agri_crm_messages_conv_idx ON agri_crm_messages(plantation_id, acheteur_user_id);

CREATE TABLE IF NOT EXISTS agri_crm_rdv (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id            uuid        NOT NULL,
  titre                    text        NOT NULL,
  date_rdv                 date        NOT NULL,
  heure                    text,
  duree_min                integer,
  type                     text        NOT NULL DEFAULT 'sur_place',
  lieu                     text,
  lien                     text,
  statut                   text        NOT NULL DEFAULT 'planifie',
  compte_rendu             text,
  compte_rendu_updated_at  timestamptz,
  created_by               uuid        NOT NULL,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agri_crm_rdv_plantation_idx ON agri_crm_rdv(plantation_id);

CREATE TABLE IF NOT EXISTS agri_crm_notes (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id   uuid        NOT NULL,
  titre           text        NOT NULL,
  contenu         text        NOT NULL DEFAULT '',
  fichiers        jsonb       DEFAULT '[]',
  created_by      uuid        NOT NULL,
  created_by_nom  text,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agri_crm_notes_plantation_idx ON agri_crm_notes(plantation_id);

CREATE TABLE IF NOT EXISTS agri_crm_confiance (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  plantation_id    uuid        NOT NULL,
  acheteur_user_id uuid        NOT NULL,
  score            integer     NOT NULL DEFAULT 3 CHECK (score BETWEEN 1 AND 5),
  note             text,
  interaction_ref  uuid,
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agri_crm_confiance_idx ON agri_crm_confiance(plantation_id, acheteur_user_id);

-- ─────────────────────────────────────────────
-- 4. RLS — activer sur toutes les tables
-- ─────────────────────────────────────────────

ALTER TABLE plantations        ENABLE ROW LEVEL SECURITY;
ALTER TABLE champs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations_meteo  ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos_terrain      ENABLE ROW LEVEL SECURITY;
ALTER TABLE acces_acheteurs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_user_roles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_crm_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_crm_rdv        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_crm_notes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE agri_crm_confiance  ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────
-- 5. POLICIES — plantations
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS plantations_policy  ON plantations;
DROP POLICY IF EXISTS plantations_select  ON plantations;
DROP POLICY IF EXISTS plantations_insert  ON plantations;
DROP POLICY IF EXISTS plantations_update  ON plantations;
DROP POLICY IF EXISTS plantations_delete  ON plantations;

CREATE POLICY plantations_select ON plantations FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM acces_acheteurs
      WHERE acces_acheteurs.plantation_id = plantations.id
        AND acces_acheteurs.acheteur_user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY plantations_insert ON plantations FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY plantations_update ON plantations FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY plantations_delete ON plantations FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ─────────────────────────────────────────────
-- 6. POLICIES — champs
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS champs_policy  ON champs;
DROP POLICY IF EXISTS champs_select  ON champs;
DROP POLICY IF EXISTS champs_write   ON champs;

CREATE POLICY champs_select ON champs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = champs.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY champs_write ON champs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = champs.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- ─────────────────────────────────────────────
-- 7. POLICIES — observations_meteo
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS observations_meteo_read  ON observations_meteo;
DROP POLICY IF EXISTS observations_meteo_write ON observations_meteo;

CREATE POLICY observations_meteo_read ON observations_meteo FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = observations_meteo.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY observations_meteo_write ON observations_meteo FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = observations_meteo.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- ─────────────────────────────────────────────
-- 8. POLICIES — photos_terrain
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS photos_terrain_read  ON photos_terrain;
DROP POLICY IF EXISTS photos_terrain_write ON photos_terrain;

CREATE POLICY photos_terrain_read ON photos_terrain FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = photos_terrain.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY photos_terrain_write ON photos_terrain FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = photos_terrain.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- ─────────────────────────────────────────────
-- 9. POLICIES — acces_acheteurs
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS acces_acheteurs_policy       ON acces_acheteurs;
DROP POLICY IF EXISTS acces_acheteurs_select       ON acces_acheteurs;
DROP POLICY IF EXISTS acces_acheteurs_admin_write  ON acces_acheteurs;

CREATE POLICY acces_acheteurs_select ON acces_acheteurs FOR SELECT
  USING (
    acheteur_user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM plantations
      WHERE plantations.id = acces_acheteurs.plantation_id
        AND plantations.user_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY acces_acheteurs_admin_write ON acces_acheteurs FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- 10. POLICIES — agri_user_roles
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS agri_user_roles_select ON agri_user_roles;
DROP POLICY IF EXISTS agri_user_roles_insert ON agri_user_roles;
DROP POLICY IF EXISTS agri_user_roles_delete ON agri_user_roles;

CREATE POLICY agri_user_roles_select ON agri_user_roles FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY agri_user_roles_insert ON agri_user_roles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY agri_user_roles_delete ON agri_user_roles FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- ─────────────────────────────────────────────
-- 11. POLICIES — CRM (accès par plantation)
-- ─────────────────────────────────────────────

DROP POLICY IF EXISTS agri_crm_messages_policy  ON agri_crm_messages;
DROP POLICY IF EXISTS agri_crm_rdv_policy        ON agri_crm_rdv;
DROP POLICY IF EXISTS agri_crm_notes_policy      ON agri_crm_notes;
DROP POLICY IF EXISTS agri_crm_confiance_policy  ON agri_crm_confiance;

CREATE POLICY agri_crm_messages_policy ON agri_crm_messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = agri_crm_messages.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY agri_crm_rdv_policy ON agri_crm_rdv FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = agri_crm_rdv.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY agri_crm_notes_policy ON agri_crm_notes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = agri_crm_notes.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

CREATE POLICY agri_crm_confiance_policy ON agri_crm_confiance FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM plantations p WHERE p.id = agri_crm_confiance.plantation_id
        AND (
          p.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM acces_acheteurs a WHERE a.plantation_id = p.id AND a.acheteur_user_id = auth.uid())
          OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
        )
    )
  );

-- ─────────────────────────────────────────────
-- 12. Supabase Storage : bucket crm-docs (privé)
-- ─────────────────────────────────────────────
-- À créer manuellement dans le Dashboard Supabase :
--   Storage > New Bucket > Name: crm-docs > Public: false
