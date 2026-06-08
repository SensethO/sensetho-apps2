-- ============================================================
-- Migration : Gestion du Temps — Projets stratégiques & RSE
-- Tables : gt_projects, gt_project_members, gt_actions, gt_time_entries
-- ============================================================

-- ── Projets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gt_projects (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  type        text        NOT NULL DEFAULT 'strategic'
                          CHECK (type IN ('strategic', 'rse', 'both')),
  color       text        NOT NULL DEFAULT '#10b981',
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'completed', 'archived')),
  start_date  date,
  end_date    date,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Membres (partage) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gt_project_members (
  project_id  uuid        NOT NULL REFERENCES public.gt_projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text        NOT NULL,
  role        text        NOT NULL DEFAULT 'editor'
                          CHECK (role IN ('editor', 'viewer')),
  invited_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- ── Actions ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gt_actions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES public.gt_projects(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  description   text,
  planned_hours numeric(8,2) NOT NULL DEFAULT 0 CHECK (planned_hours >= 0),
  status        text        NOT NULL DEFAULT 'todo'
                            CHECK (status IN ('todo', 'in_progress', 'done', 'cancelled')),
  assigned_to   uuid        REFERENCES auth.users(id),
  priority      text        NOT NULL DEFAULT 'medium'
                            CHECK (priority IN ('low', 'medium', 'high')),
  due_date      date,
  order_index   int         NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Saisies de temps ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.gt_time_entries (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id   uuid        NOT NULL REFERENCES public.gt_actions(id) ON DELETE CASCADE,
  project_id  uuid        NOT NULL REFERENCES public.gt_projects(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_email  text        NOT NULL,
  date        date        NOT NULL,
  hours       numeric(5,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Index ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS gt_projects_owner_idx ON public.gt_projects(owner_id);
CREATE INDEX IF NOT EXISTS gt_members_user_idx   ON public.gt_project_members(user_id);
CREATE INDEX IF NOT EXISTS gt_actions_project_idx ON public.gt_actions(project_id);
CREATE INDEX IF NOT EXISTS gt_entries_project_idx ON public.gt_time_entries(project_id);
CREATE INDEX IF NOT EXISTS gt_entries_user_idx    ON public.gt_time_entries(user_id);
CREATE INDEX IF NOT EXISTS gt_entries_date_idx    ON public.gt_time_entries(date);

-- ── RLS ───────────────────────────────────────────────────────
ALTER TABLE public.gt_projects        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_actions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gt_time_entries    ENABLE ROW LEVEL SECURITY;

-- gt_projects : visible si owner ou membre
CREATE POLICY "gt_projects_select" ON public.gt_projects
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid() OR
    id IN (SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid())
  );
CREATE POLICY "gt_projects_insert" ON public.gt_projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "gt_projects_update" ON public.gt_projects
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "gt_projects_delete" ON public.gt_projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

-- gt_project_members : visible si membre du projet
CREATE POLICY "gt_members_select" ON public.gt_project_members
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.gt_projects
    WHERE owner_id = auth.uid() OR id IN (
      SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "gt_members_insert" ON public.gt_project_members
  FOR INSERT TO authenticated WITH CHECK (
    project_id IN (SELECT id FROM public.gt_projects WHERE owner_id = auth.uid())
  );
CREATE POLICY "gt_members_delete" ON public.gt_project_members
  FOR DELETE TO authenticated USING (
    project_id IN (SELECT id FROM public.gt_projects WHERE owner_id = auth.uid())
  );

-- gt_actions : visible si membre du projet
CREATE POLICY "gt_actions_select" ON public.gt_actions
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT id FROM public.gt_projects
    WHERE owner_id = auth.uid() OR id IN (
      SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid()
    )
  ));
CREATE POLICY "gt_actions_insert" ON public.gt_actions
  FOR INSERT TO authenticated WITH CHECK (project_id IN (
    SELECT id FROM public.gt_projects WHERE owner_id = auth.uid() OR id IN (
      SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid()
        AND role = 'editor'
    )
  ));
CREATE POLICY "gt_actions_update" ON public.gt_actions
  FOR UPDATE TO authenticated USING (project_id IN (
    SELECT id FROM public.gt_projects WHERE owner_id = auth.uid() OR id IN (
      SELECT project_id FROM public.gt_project_members WHERE user_id = auth.uid()
        AND role = 'editor'
    )
  ));
CREATE POLICY "gt_actions_delete" ON public.gt_actions
  FOR DELETE TO authenticated USING (project_id IN (
    SELECT id FROM public.gt_projects WHERE owner_id = auth.uid()
  ));

-- gt_time_entries : chacun voit ses propres saisies + le propriétaire du projet voit tout
CREATE POLICY "gt_entries_select" ON public.gt_time_entries
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid() OR
    project_id IN (SELECT id FROM public.gt_projects WHERE owner_id = auth.uid())
  );
CREATE POLICY "gt_entries_insert" ON public.gt_time_entries
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "gt_entries_update" ON public.gt_time_entries
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "gt_entries_delete" ON public.gt_time_entries
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- ── Enregistrement dans le catalogue des apps ────────────────
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active)
SELECT
  'Gestion du Temps',
  'gestion-temps',
  'Planifiez et suivez le temps passé sur vos projets stratégiques et RSE. Comparez le prévisionnel au réalisé par action et par contributeur.',
  'clock',
  '/rse/gestion-temps',
  id,
  80,
  true
FROM public.app_categories WHERE slug = 'rse'
ON CONFLICT (slug) DO UPDATE SET
  name        = EXCLUDED.name,
  description = EXCLUDED.description,
  icon        = EXCLUDED.icon,
  route       = EXCLUDED.route,
  is_active   = EXCLUDED.is_active,
  updated_at  = now();
