-- ============================================================
-- EcoVadis Diagnostic RSE
-- Suit les patterns de guided_diagnostics.sql
-- ============================================================

-- Table principale : un diagnostic par (user, org, annee)
CREATE TABLE IF NOT EXISTS public.ecovadis_diagnostics (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id               UUID        NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id              UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  annee                INTEGER     NOT NULL,
  statut               TEXT        NOT NULL DEFAULT 'brouillon',  -- brouillon | soumis
  score_global         NUMERIC(5,2),                              -- 0-100, calculé côté client
  attachment_counter   INTEGER     NOT NULL DEFAULT 0,            -- préfixes A001_ atomiques
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, org_id, annee)
);

ALTER TABLE public.ecovadis_diagnostics ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecovadis_diag_owner ON public.ecovadis_diagnostics
  FOR ALL USING (auth.uid() = user_id);
CREATE POLICY ecovadis_diag_admin ON public.ecovadis_diagnostics
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

CREATE INDEX IF NOT EXISTS idx_ecovadis_diag_user ON public.ecovadis_diagnostics(user_id);
CREATE INDEX IF NOT EXISTS idx_ecovadis_diag_org  ON public.ecovadis_diagnostics(org_id);

-- Réponses par critère (niveau 0-4 + commentaire)
CREATE TABLE IF NOT EXISTS public.ecovadis_reponses (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID        NOT NULL REFERENCES public.ecovadis_diagnostics(id) ON DELETE CASCADE,
  critere_id    TEXT        NOT NULL,
  niveau        SMALLINT    NOT NULL DEFAULT 0 CHECK (niveau BETWEEN 0 AND 4),
  commentaire   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(diagnostic_id, critere_id)
);

ALTER TABLE public.ecovadis_reponses ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecovadis_reponses_access ON public.ecovadis_reponses
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ecovadis_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')))
  );

CREATE INDEX IF NOT EXISTS idx_ecovadis_rep_diag ON public.ecovadis_reponses(diagnostic_id);

-- Actions d'amélioration par critère
CREATE TABLE IF NOT EXISTS public.ecovadis_actions (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID        NOT NULL REFERENCES public.ecovadis_diagnostics(id) ON DELETE CASCADE,
  critere_id    TEXT        NOT NULL,
  titre         TEXT        NOT NULL,
  description   TEXT,
  priorite      TEXT        NOT NULL DEFAULT 'moyenne', -- haute | moyenne | basse
  statut        TEXT        NOT NULL DEFAULT 'a_faire', -- a_faire | en_cours | termine
  echeance      DATE,
  responsable   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ecovadis_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecovadis_actions_access ON public.ecovadis_actions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ecovadis_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')))
  );

CREATE INDEX IF NOT EXISTS idx_ecovadis_act_diag   ON public.ecovadis_actions(diagnostic_id);
CREATE INDEX IF NOT EXISTS idx_ecovadis_act_critere ON public.ecovadis_actions(critere_id);

-- Documents/preuves (métadonnées uniquement — fichiers dans SharePoint)
CREATE TABLE IF NOT EXISTS public.ecovadis_documents (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  diagnostic_id UUID        NOT NULL REFERENCES public.ecovadis_diagnostics(id) ON DELETE CASCADE,
  critere_id    TEXT,                                   -- rattaché à un critère (optionnel)
  nom           TEXT        NOT NULL,                   -- avec préfixe A001_
  description   TEXT,
  type_doc      TEXT,                                   -- politique | rapport | certificat | procédure | autre
  sp_item_id    TEXT        NOT NULL,                   -- ID item SharePoint Graph
  sp_path       TEXT,                                   -- chemin lisible
  size          BIGINT,
  annexe_index  INTEGER,                                -- numéro atomique du préfixe
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.ecovadis_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY ecovadis_docs_access ON public.ecovadis_documents
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.ecovadis_diagnostics d
            WHERE d.id = diagnostic_id
            AND (d.user_id = auth.uid()
                 OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')))
  );

CREATE INDEX IF NOT EXISTS idx_ecovadis_doc_diag ON public.ecovadis_documents(diagnostic_id);

-- Fonction atomique pour les préfixes A001_ (même pattern que guided_diagnostics)
CREATE OR REPLACE FUNCTION public.increment_ecovadis_attachment_counter(p_id uuid)
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.ecovadis_diagnostics
  SET    attachment_counter = attachment_counter + 1,
         updated_at         = NOW()
  WHERE  id = p_id
  RETURNING attachment_counter;
$$;
