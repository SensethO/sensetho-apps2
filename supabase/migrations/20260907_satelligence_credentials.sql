-- Identifiants API Satelligence, par organisation.
-- Le token (Bearer) est chiffré au repos (AES-256-GCM, clé dérivée de EUDR_CRED_SECRET,
-- réutilisée de lib/eudr/crypto). Jamais renvoyé au navigateur.
create table if not exists satelligence_credentials (
  org_id       uuid primary key references organisations(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  token_enc    text not null,
  environment  text not null default 'production' check (environment in ('production','mock')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table satelligence_credentials enable row level security;

-- Propriétaire (créateur) ou admin. L'accès applicatif passe de toute façon par le
-- service role côté serveur ; ces policies protègent l'accès direct.
drop policy if exists sat_creds_select on satelligence_credentials;
create policy sat_creds_select on satelligence_credentials for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists sat_creds_write on satelligence_credentials;
create policy sat_creds_write on satelligence_credentials for all
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
