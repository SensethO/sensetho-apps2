-- Rattachement d'une parcelle à son fournisseur, et trace de ce rattachement.
--
-- `eudr_plots` porte déjà `supplier_id` depuis 20260806 : le versement hérite du
-- fournisseur du fichier d'origine. Mais un fichier déposé sans entité de
-- rattachement produit des parcelles orphelines, que rien ne permettait ensuite
-- de rattacher. L'onglet « Parcelles » le permet ; cette migration en garantit
-- le support et en consigne la provenance.
--
-- Un rattachement hérité du fichier et un rattachement saisi à la main n'ont pas
-- la même valeur probante : le second doit dire qui l'a fait et quand, faute de
-- quoi le référentiel affirme un lien sans pouvoir en répondre.
--
-- Idempotente : rejouable sans effet de bord.

-- 1. Le lien lui-même (déjà présent sur une base à jour ; garanti ici).
alter table public.eudr_plots
  add column if not exists supplier_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.eudr_plots'::regclass
      and conname = 'eudr_plots_supplier_id_fkey'
  ) then
    alter table public.eudr_plots
      add constraint eudr_plots_supplier_id_fkey
      foreign key (supplier_id) references public.eudr_suppliers(id) on delete set null;
  end if;
end $$;

-- 2. Provenance du rattachement.
alter table public.eudr_plots
  add column if not exists supplier_assigned_at timestamptz;
alter table public.eudr_plots
  add column if not exists supplier_assigned_by text;

-- 3. Index de lecture par fournisseur (le filtre le plus fréquent de l'onglet).
create index if not exists eudr_plots_supplier_idx
  on public.eudr_plots (supplier_id) where is_current;

-- Parcelles orphelines : la liste de travail de l'onglet « Parcelles ».
create index if not exists eudr_plots_sans_fournisseur_idx
  on public.eudr_plots (org_id) where is_current and supplier_id is null;

-- 4. RLS : lecture alignée sur les autres tables eudr_*, écriture réservée au
-- propriétaire de l'organisation ou à un administrateur. L'accès applicatif
-- passe par le service role et `canAccessOrgDossier`, mais la table doit rester
-- close par elle-même si elle est lue directement.
alter table public.eudr_plots enable row level security;

drop policy if exists eudr_plots_membre on public.eudr_plots;
create policy eudr_plots_membre on public.eudr_plots
  for select
  using (
    exists (select 1 from public.organisations o where o.id = eudr_plots.org_id and o.user_id = auth.uid())
    or exists (select 1 from public.eudr_suppliers s where s.org_id = eudr_plots.org_id and s.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists eudr_plots_ecriture on public.eudr_plots;
create policy eudr_plots_ecriture on public.eudr_plots
  for update
  using (
    exists (select 1 from public.organisations o where o.id = eudr_plots.org_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.organisations o where o.id = eudr_plots.org_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

comment on column public.eudr_plots.supplier_assigned_at is
  'Date du rattachement manuel au fournisseur (nul si le rattachement est hérité du fichier versé).';
comment on column public.eudr_plots.supplier_assigned_by is
  'Auteur du rattachement manuel : un lien affirmé doit pouvoir être imputé.';
