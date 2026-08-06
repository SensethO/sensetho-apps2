-- Référentiel des parcelles.
--
-- Socle de la traçabilité : sans identité stable de parcelle, impossible de
-- relier un lot livré aux terres déclarées, ni de détecter qu'un même contour
-- est vendu par deux fournisseurs différents.
--
-- ⚠️ La géométrie complète n'est PAS recopiée ici. Le fichier GeoJSON reste sur
-- SharePoint, conformément à la règle du projet. Ne sont conservées que les
-- valeurs dérivées nécessaires aux contrôles : surface, centroïde, emprise et
-- empreinte du contour. Une comparaison fine relit le fichier à la source.

create table if not exists public.eudr_plots (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references public.organisations(id) on delete cascade,
  supplier_id       uuid references public.eudr_suppliers(id) on delete set null,
  -- Fichier d'origine : c'est lui qui fait foi, la table n'en est qu'un index.
  attachment_id     uuid not null references public.eudr_attachments(id) on delete cascade,
  feature_index     integer not null,

  plot_ref          text,
  producer_name     text,
  commodity         text,
  country           text,

  geometry_type     text,
  declared_area_ha  numeric(12,4),
  computed_area_ha  numeric(12,4),
  centroid_lon      numeric(10,6),
  centroid_lat      numeric(10,6),
  bbox              numeric(10,6)[],
  -- Empreinte du contour arrondi : détecte un contour identique déclaré par
  -- deux fournisseurs, ce qu'un contrôle fichier par fichier ne peut pas voir.
  geom_hash         text,

  -- Métadonnées du relevé exigées à l'article 9 : un relevé sans date ni source
  -- ne peut pas fonder une déclaration.
  survey_date       date,
  survey_source     text,

  -- Un fournisseur qui corrige son fichier crée une nouvelle version ; les
  -- anciennes restent, la diligence devant rester démontrable dans le temps.
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  created_by        text,

  unique (attachment_id, feature_index)
);

create index if not exists eudr_plots_org_idx on public.eudr_plots (org_id) where is_current;
create index if not exists eudr_plots_supplier_idx on public.eudr_plots (supplier_id) where is_current;
create index if not exists eudr_plots_hash_idx on public.eudr_plots (org_id, geom_hash) where is_current;

alter table public.eudr_plots enable row level security;

drop policy if exists eudr_plots_membre on public.eudr_plots;
create policy eudr_plots_membre on public.eudr_plots
  for select
  using (exists (
    select 1 from public.eudr_suppliers s
    where s.org_id = eudr_plots.org_id and s.user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));

-- Contours identiques déclarés par des fournisseurs différents : signal de
-- fraude qu'aucun contrôle fichier par fichier ne peut lever.
create or replace view public.eudr_plots_doublons as
select
  p.org_id,
  p.geom_hash,
  count(*) as occurrences,
  count(distinct p.supplier_id) as fournisseurs,
  array_agg(distinct p.supplier_id) as supplier_ids,
  array_agg(p.id) as plot_ids,
  max(p.computed_area_ha) as surface_ha
from public.eudr_plots p
where p.is_current and p.geom_hash is not null
group by p.org_id, p.geom_hash
having count(*) > 1;
