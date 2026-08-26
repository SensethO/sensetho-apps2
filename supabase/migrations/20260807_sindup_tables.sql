-- App « Veille stratégique (Sindup) » — tables de la veille intégrée à la plateforme.
-- Deux connecteurs : flux RSS/Atom Sindup (opérationnel) et API Sindup (préparé,
-- identifiants chiffrés, client à brancher quand la doc sera disponible).
-- ⚠️ À appliquer sur le projet Supabase PARIS (pjrwjfozzynmjvbygqev). Idempotente.

-- ---------------------------------------------------------------------------
-- Sources de veille (flux RSS/Atom Sindup, ou source API à venir)
-- ---------------------------------------------------------------------------
create table if not exists public.sindup_sources (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  type             text not null default 'rss' check (type in ('rss', 'api')),
  label            text not null,
  url              text,
  actif            boolean not null default true,
  last_fetch_at    timestamptz,
  last_status      text,
  last_error       text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_sindup_sources_org on public.sindup_sources (organisation_id);

-- Trigger updated_at (fonction partagée de la plateforme).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_sindup_sources_updated_at on public.sindup_sources;
create trigger trg_sindup_sources_updated_at
  before update on public.sindup_sources
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Mentions collectées (items des flux)
-- ---------------------------------------------------------------------------
create table if not exists public.sindup_mentions (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid not null references public.organisations(id) on delete cascade,
  source_id        uuid not null references public.sindup_sources(id) on delete cascade,
  guid             text not null,
  titre            text,
  url              text,
  extrait          text,
  auteur           text,
  published_at     timestamptz,
  image_url        text,
  lu               boolean not null default false,
  favori           boolean not null default false,
  created_at       timestamptz not null default now()
);

-- Anti-doublon par source + tri principal.
create unique index if not exists idx_sindup_mentions_source_guid
  on public.sindup_mentions (source_id, guid);
create index if not exists idx_sindup_mentions_org_published
  on public.sindup_mentions (organisation_id, published_at desc);

-- ---------------------------------------------------------------------------
-- Connexion API Sindup (préparation — clé chiffrée AES-256-GCM côté serveur,
-- dérivée de SINDUP_CRED_SECRET, repli EUDR_CRED_SECRET ; client API à brancher
-- quand la doc Sindup sera disponible).
-- ---------------------------------------------------------------------------
create table if not exists public.sindup_connections (
  id               uuid primary key default gen_random_uuid(),
  organisation_id  uuid unique not null references public.organisations(id) on delete cascade,
  api_key_cipher   text not null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

drop trigger if exists trg_sindup_connections_updated_at on public.sindup_connections;
create trigger trg_sindup_connections_updated_at
  before update on public.sindup_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : propriétaire de l'organisation (organisations.user_id = auth.uid())
-- ou admin (profiles.role = 'admin'). L'accès applicatif passe par le service
-- role côté serveur ; ces policies protègent l'accès direct.
-- ---------------------------------------------------------------------------
alter table public.sindup_sources enable row level security;
alter table public.sindup_mentions enable row level security;
alter table public.sindup_connections enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['sindup_sources', 'sindup_mentions', 'sindup_connections'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format($p$
      create policy %1$s_select on public.%1$s for select
        using (
          exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    $p$, t);

    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format($p$
      create policy %1$s_insert on public.%1$s for insert
        with check (
          exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    $p$, t);

    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format($p$
      create policy %1$s_update on public.%1$s for update
        using (
          exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
        with check (
          exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    $p$, t);

    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format($p$
      create policy %1$s_delete on public.%1$s for delete
        using (
          exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
          or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
        )
    $p$, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Catalogue : l'app devient une vraie app intégrée (veille dans la plateforme),
-- sur devis.
-- ---------------------------------------------------------------------------
update public.apps
set pricing_type = 'quote',
    description  = 'Veille stratégique connectée à Sindup : vos flux de veille (mentions presse, web, réseaux) remontent dans la plateforme — tableau de bord, filtres, favoris, collecte automatique 3 fois par jour.'
where slug = 'veille-sindup';
