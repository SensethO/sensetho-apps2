-- App « Projet RSE » — extension « Système de création de valeur » (PMI PMBOK) :
-- hiérarchie Portefeuilles → Programmes → Projets + couche Opérations.
-- Un portefeuille contient des programmes ET des projets directement rattachés ;
-- un programme peut exister hors portefeuille ; un projet peut être autonome ;
-- les livrables des projets sont transférés aux Opérations (activités permanentes).
-- Migration idempotente.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists projet_rse_portefeuilles (
  id                     uuid primary key default gen_random_uuid(),
  organisation_id        uuid not null references organisations(id) on delete cascade,
  nom                    text not null,
  description            text,
  objectifs_strategiques text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_projet_rse_portefeuilles_org
  on projet_rse_portefeuilles(organisation_id);

create table if not exists projet_rse_programmes (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  portefeuille_id  uuid references projet_rse_portefeuilles(id) on delete set null,
  nom              text not null,
  description      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_projet_rse_programmes_org
  on projet_rse_programmes(organisation_id);
create index if not exists idx_projet_rse_programmes_portefeuille
  on projet_rse_programmes(portefeuille_id);

-- Rattachement des projets : programme OU portefeuille direct OU autonome.
-- Pas de contrainte d'exclusivité stricte ; si programme_id est posé,
-- le portefeuille effectif est celui du programme.
alter table projet_rse_projets
  add column if not exists programme_id uuid references projet_rse_programmes(id) on delete set null,
  add column if not exists portefeuille_id uuid references projet_rse_portefeuilles(id) on delete set null;

create index if not exists idx_projet_rse_projets_programme
  on projet_rse_projets(programme_id);
create index if not exists idx_projet_rse_projets_portefeuille
  on projet_rse_projets(portefeuille_id);

-- Opérations : activités permanentes recevant les livrables des projets.
create table if not exists projet_rse_operations (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  nom              text not null,
  description      text,
  projet_source_id uuid references projet_rse_projets(id) on delete set null,
  statut           text not null default 'active'
                     check (statut in ('active', 'arretee')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_projet_rse_operations_org
  on projet_rse_operations(organisation_id);
create index if not exists idx_projet_rse_operations_projet_source
  on projet_rse_operations(projet_source_id);

-- ---------------------------------------------------------------------------
-- Trigger updated_at (réutilise projet_rse_set_updated_at)
-- ---------------------------------------------------------------------------

drop trigger if exists trg_projet_rse_portefeuilles_updated_at on projet_rse_portefeuilles;
create trigger trg_projet_rse_portefeuilles_updated_at
  before update on projet_rse_portefeuilles
  for each row execute function projet_rse_set_updated_at();

drop trigger if exists trg_projet_rse_programmes_updated_at on projet_rse_programmes;
create trigger trg_projet_rse_programmes_updated_at
  before update on projet_rse_programmes
  for each row execute function projet_rse_set_updated_at();

drop trigger if exists trg_projet_rse_operations_updated_at on projet_rse_operations;
create trigger trg_projet_rse_operations_updated_at
  before update on projet_rse_operations
  for each row execute function projet_rse_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : propriétaire de l'organisation ou admin
-- ---------------------------------------------------------------------------

alter table projet_rse_portefeuilles enable row level security;
alter table projet_rse_programmes enable row level security;
alter table projet_rse_operations enable row level security;

drop policy if exists projet_rse_portefeuilles_all on projet_rse_portefeuilles;
create policy projet_rse_portefeuilles_all on projet_rse_portefeuilles for all
  using (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_portefeuilles.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_portefeuilles.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists projet_rse_programmes_all on projet_rse_programmes;
create policy projet_rse_programmes_all on projet_rse_programmes for all
  using (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_programmes.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_programmes.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists projet_rse_operations_all on projet_rse_operations;
create policy projet_rse_operations_all on projet_rse_operations for all
  using (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_operations.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_operations.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
