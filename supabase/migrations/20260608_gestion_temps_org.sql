-- Migration : ajouter org_id à gt_projects pour isoler les données par organisation

ALTER TABLE public.gt_projects
  ADD COLUMN IF NOT EXISTS org_id uuid REFERENCES public.organisations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS gt_projects_org_idx ON public.gt_projects(org_id);

-- Note : les projets existants sans org_id resteront visibles uniquement via owner_id / membership.
-- Les nouveaux projets créés via l'app auront toujours un org_id.
