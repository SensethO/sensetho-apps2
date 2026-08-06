-- Tri automatique des fichiers de géolocalisation : résultats consignés.
--
-- Le règlement impose de conserver les éléments de diligence 5 ans (art. 33).
-- Un contrôle exécuté sans trace ne prouve rien : chaque passage est donc
-- historisé, y compris les passages successifs après correction du fournisseur.

create table if not exists public.eudr_geo_screening (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  attachment_id  uuid not null references public.eudr_attachments(id) on delete cascade,
  -- Pays déclaré au moment du contrôle : le résultat en dépend (test d'emprise).
  pays_declare   text,
  nb_parcelles   integer not null default 0,
  surface_ha     numeric(14,4) not null default 0,
  nb_bloquants   integer not null default 0,
  nb_alertes     integer not null default 0,
  exploitable    boolean not null default false,
  constats       jsonb not null default '[]'::jsonb,
  -- Version du moteur : un constat n'est interprétable qu'au regard des règles
  -- en vigueur lors de son exécution.
  moteur_version text not null default 'v1',
  analyzed_at    timestamptz not null default now(),
  analyzed_by    text
);

create index if not exists eudr_geo_screening_attachment_idx
  on public.eudr_geo_screening (attachment_id, analyzed_at desc);
create index if not exists eudr_geo_screening_org_idx
  on public.eudr_geo_screening (org_id, analyzed_at desc);

alter table public.eudr_geo_screening enable row level security;

-- Même règle d'accès que le reste du module : les routes serveur passent par le
-- service_role, les lectures directes restent réservées aux membres de l'organisation.
drop policy if exists eudr_geo_screening_membre on public.eudr_geo_screening;
create policy eudr_geo_screening_membre on public.eudr_geo_screening
  for select
  using (exists (
    select 1 from public.eudr_suppliers s
    where s.org_id = eudr_geo_screening.org_id and s.user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
