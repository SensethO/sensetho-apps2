-- Connexions Qonto (API tierce https://thirdparty.qonto.com/v2), par organisation.
-- La clé secrète (secret key) est chiffrée au repos (AES-256-GCM, clé dérivée de
-- QONTO_CRED_SECRET, repli EUDR_CRED_SECRET). Jamais renvoyée au navigateur.
-- Une seule connexion par organisation (UNIQUE organisation_id) ; une organisation
-- Qonto peut exposer plusieurs comptes bancaires (multi-IBAN) via l'API.

create table if not exists public.qonto_connections (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid unique not null references public.organisations(id) on delete cascade,
  login              text not null,
  secret_key_cipher  text not null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Trigger updated_at (fonction partagée de la plateforme).
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists trg_qonto_connections_updated_at on public.qonto_connections;
create trigger trg_qonto_connections_updated_at
  before update on public.qonto_connections
  for each row execute function public.set_updated_at();

alter table public.qonto_connections enable row level security;

-- Propriétaire de l'organisation (organisations.user_id) ou admin (profiles.role).
-- L'accès applicatif passe par le service role côté serveur ; ces policies
-- protègent l'accès direct.
drop policy if exists qonto_connections_select on public.qonto_connections;
create policy qonto_connections_select on public.qonto_connections for select
  using (
    exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists qonto_connections_insert on public.qonto_connections;
create policy qonto_connections_insert on public.qonto_connections for insert
  with check (
    exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists qonto_connections_update on public.qonto_connections;
create policy qonto_connections_update on public.qonto_connections for update
  using (
    exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists qonto_connections_delete on public.qonto_connections;
create policy qonto_connections_delete on public.qonto_connections for delete
  using (
    exists (select 1 from public.organisations o where o.id = organisation_id and o.user_id = auth.uid())
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );
