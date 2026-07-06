-- COA : rôles d'accès + champs additionnels.
-- Rôles (gérés par le propriétaire du dossier) : lecture / ecriture / superviseur.
-- L'ajout d'un membre crée aussi un partage du dossier (rse_diagnostic_shares) côté serveur.

alter table eudr_coa
  add column if not exists document_date     text,   -- date figurant sur le COA
  add column if not exists uploaded_by_email  text;   -- personne ayant déposé le fichier

create table if not exists eudr_coa_members (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'lecture' check (role in ('lecture','ecriture','superviseur')),
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, user_id)
);

alter table eudr_coa_members enable row level security;
drop policy if exists eudr_coa_members_all on eudr_coa_members;
create policy eudr_coa_members_all on eudr_coa_members for all
  using (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
    or user_id = auth.uid()
  )
  with check (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Remplace l'ancienne liste de responsables (le rôle « superviseur » la remplace).
drop table if exists eudr_coa_responsables;
