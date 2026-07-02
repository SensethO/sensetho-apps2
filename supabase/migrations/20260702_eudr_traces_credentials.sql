-- Identifiants Web Service EUDR TRACES, par organisation.
-- La clé d'authentification (webservice key) est chiffrée au repos (AES-256-GCM,
-- clé dérivée de EUDR_CRED_SECRET). Jamais renvoyée au navigateur.
create table if not exists eudr_traces_credentials (
  org_id        uuid primary key references organisations(id) on delete cascade,
  user_id       uuid not null references auth.users(id) on delete cascade,
  username      text not null,
  auth_key_enc  text not null,
  environment   text not null default 'acceptance' check (environment in ('acceptance','production')),
  client_id     text not null default 'eudr-test',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table eudr_traces_credentials enable row level security;

-- Propriétaire (créateur) ou admin. L'accès applicatif passe de toute façon par le
-- service role côté serveur ; ces policies protègent l'accès direct.
drop policy if exists eudr_traces_creds_select on eudr_traces_credentials;
create policy eudr_traces_creds_select on eudr_traces_credentials for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists eudr_traces_creds_write on eudr_traces_credentials;
create policy eudr_traces_creds_write on eudr_traces_credentials for all
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
