-- Analyse des COA (Certificate of Analysis) pour l'app eudr-fournisseurs.
-- Le fichier COA et la « demande client » sont stockés sur SharePoint (eudr_attachments) ;
-- l'extraction/analyse/validation vivent ici en JSONB. Aucun fichier n'est stocké en base.

create table if not exists eudr_coa (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references organisations(id) on delete cascade,
  user_id                     uuid not null references auth.users(id) on delete cascade,
  label                       text,
  supplier_id                 uuid references eudr_suppliers(id) on delete set null,
  contract_id                 uuid references eudr_contracts(id) on delete set null,
  source_attachment_id        uuid references eudr_attachments(id) on delete set null,
  client_demand_attachment_id uuid references eudr_attachments(id) on delete set null,
  status                      text not null default 'draft' check (status in ('draft','analyzed','validated')),
  extracted                   jsonb not null default '{}'::jsonb,   -- { header, rows[] }
  analysis                    jsonb not null default '[]'::jsonb,   -- [{ parametre, verdict, reason, source }]
  summary                     jsonb not null default '{}'::jsonb,   -- { conforme, resume, counts }
  points_a_verifier           jsonb not null default '[]'::jsonb,   -- [ string ]
  analyzed_at                 timestamptz,
  analyzed_model              text,
  validated_by                text,   -- email du responsable qui a validé
  validated_at                timestamptz,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);
create index if not exists eudr_coa_org_idx on eudr_coa(org_id);

-- Liste dédiée de responsables habilités à valider les COA (par organisation).
create table if not exists eudr_coa_responsables (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organisations(id) on delete cascade,
  email       text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (org_id, email)
);

alter table eudr_coa enable row level security;
alter table eudr_coa_responsables enable row level security;

-- Accès direct : propriétaire de l'organisation ou admin (l'app passe par le service role + guard).
drop policy if exists eudr_coa_all on eudr_coa;
create policy eudr_coa_all on eudr_coa for all
  using (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists eudr_coa_resp_all on eudr_coa_responsables;
create policy eudr_coa_resp_all on eudr_coa_responsables for all
  using (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );
