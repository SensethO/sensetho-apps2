-- App « Projet RSE » — gestion de projet RSE selon la méthode PRiSM :
-- cycle en 5 phases (pre_project → discovery → design → delivery → closure),
-- revues de phase go/no-go, sous-application Parties prenantes
-- (matrice pouvoir × intérêt + plan d'engagement).
-- Migration idempotente.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists projet_rse_projets (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references organisations(id) on delete cascade,
  nom              text not null,
  description      text,
  contexte         text,
  statut           text not null default 'actif'
                     check (statut in ('actif', 'suspendu', 'clos')),
  phase            text not null default 'pre_project'
                     check (phase in ('pre_project', 'discovery', 'design', 'delivery', 'closure')),
  date_debut       date,
  date_fin_prevue  date,
  -- Business case (structure libre v1) : justification, alternatives,
  -- objectifs, seuils d'impact, critères de succès.
  business_case    jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_projet_rse_projets_org
  on projet_rse_projets(organisation_id);

create table if not exists projet_rse_revues (
  id                   uuid primary key default gen_random_uuid(),
  projet_id            uuid not null references projet_rse_projets(id) on delete cascade,
  phase                text not null
                         check (phase in ('pre_project', 'discovery', 'design', 'delivery', 'closure')),
  decision             text not null
                         check (decision in ('go', 'no_go', 'conditionnel')),
  commentaire          text,
  business_case_valide boolean,
  seuils_respectes     boolean,
  decide_le            date not null default current_date,
  created_at           timestamptz not null default now()
);

create index if not exists idx_projet_rse_revues_projet
  on projet_rse_revues(projet_id);

create table if not exists projet_rse_parties (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references projet_rse_projets(id) on delete cascade,
  nom           text not null,
  organisation  text,
  -- Méthode du cours : verte = opérationnel quotidien, orange = gouvernance,
  -- bleue = externe critique (inclut « la société » et « la Terre »).
  categorie     text not null default 'bleue'
                  check (categorie in ('verte', 'orange', 'bleue')),
  role          text,
  pouvoir       integer not null default 3 check (pouvoir between 1 and 5),
  interet       integer not null default 3 check (interet between 1 and 5),
  attitude      text not null default 'neutre'
                  check (attitude in ('alliee', 'ouverte', 'neutre', 'vigilante', 'opposee')),
  attentes      text,
  verbatims     text,
  -- Stratégie d'engagement déduite du quadrant pouvoir × intérêt, éditable.
  strategie     text,
  statut_suivi  text not null default 'a_engager'
                  check (statut_suivi in ('a_engager', 'engagee', 'a_risque', 'ok')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_projet_rse_parties_projet
  on projet_rse_parties(projet_id);

create table if not exists projet_rse_engagements (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references projet_rse_projets(id) on delete cascade,
  partie_id   uuid not null references projet_rse_parties(id) on delete cascade,
  action      text not null,
  responsable text,
  canal       text,
  frequence   text,
  echeance    date,
  statut      text not null default 'a_faire'
                check (statut in ('a_faire', 'en_cours', 'fait')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_projet_rse_engagements_projet
  on projet_rse_engagements(projet_id);
create index if not exists idx_projet_rse_engagements_partie
  on projet_rse_engagements(partie_id);

-- ---------------------------------------------------------------------------
-- Trigger updated_at
-- ---------------------------------------------------------------------------

create or replace function projet_rse_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_projet_rse_projets_updated_at on projet_rse_projets;
create trigger trg_projet_rse_projets_updated_at
  before update on projet_rse_projets
  for each row execute function projet_rse_set_updated_at();

drop trigger if exists trg_projet_rse_parties_updated_at on projet_rse_parties;
create trigger trg_projet_rse_parties_updated_at
  before update on projet_rse_parties
  for each row execute function projet_rse_set_updated_at();

drop trigger if exists trg_projet_rse_engagements_updated_at on projet_rse_engagements;
create trigger trg_projet_rse_engagements_updated_at
  before update on projet_rse_engagements
  for each row execute function projet_rse_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : propriétaire de l'organisation ou admin
-- ---------------------------------------------------------------------------

alter table projet_rse_projets enable row level security;
alter table projet_rse_revues enable row level security;
alter table projet_rse_parties enable row level security;
alter table projet_rse_engagements enable row level security;

drop policy if exists projet_rse_projets_all on projet_rse_projets;
create policy projet_rse_projets_all on projet_rse_projets for all
  using (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_projets.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from organisations o
      where o.id = projet_rse_projets.organisation_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists projet_rse_revues_all on projet_rse_revues;
create policy projet_rse_revues_all on projet_rse_revues for all
  using (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_revues.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_revues.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists projet_rse_parties_all on projet_rse_parties;
create policy projet_rse_parties_all on projet_rse_parties for all
  using (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_parties.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_parties.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists projet_rse_engagements_all on projet_rse_engagements;
create policy projet_rse_engagements_all on projet_rse_engagements for all
  using (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_engagements.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_engagements.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Entrée catalogue (catégorie RSE)
-- ---------------------------------------------------------------------------

insert into apps (name, slug, description, icon, route, category_id, pricing_type, is_for_sale, is_active)
values (
  'Projet RSE',
  'projet-rse',
  'Gestion de projet RSE selon la méthode PRiSM : cycle en 5 phases avec revues go/no-go, sous-applications intégrées — parties prenantes (matrice pouvoir × intérêt, plan d''engagement), cadrage, analyse d''impact P5, plan de management de la durabilité, impact social.',
  '🧩',
  '/rse/projet-rse',
  '4d65b2fe-7c6a-4878-ad74-0eee704d9dd6',
  'quote',
  true,
  true
)
on conflict (slug) do nothing;
