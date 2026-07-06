-- Métadonnées des documents EUDR. Les FICHIERS eux-mêmes sont stockés dans SharePoint
-- (upload navigateur → SharePoint direct) ; ici on ne stocke QUE les métadonnées.
create table if not exists eudr_attachments (
  id                 uuid primary key default gen_random_uuid(),
  org_id             uuid not null references organisations(id) on delete cascade,
  entity_type        text not null check (entity_type in ('supplier','contract')),
  entity_id          uuid not null,
  doc_type           text not null default 'other'
                       check (doc_type in ('geojson','questionnaire','certificate','ddr','dds','other')),
  name               text not null,
  sharepoint_item_id text not null,
  mime               text,
  size               bigint,
  created_by         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now()
);

create index if not exists eudr_attachments_entity_idx on eudr_attachments (org_id, entity_type, entity_id);

alter table eudr_attachments enable row level security;

-- Propriétaire de l'org ou admin (l'accès applicatif passe par le service role + canAccessOrgDossier).
drop policy if exists eudr_attachments_rw on eudr_attachments;
create policy eudr_attachments_rw on eudr_attachments for all
  using (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Dossier SharePoint dédié à l'app métier eudr-fournisseurs.
insert into sp_app_routes (app_key, folder_name, sp_config_id)
values ('eudr-fournisseurs', 'EUDR-FOURNISSEURS', 'd05f7097-aaf1-4a1a-a685-ba0755f8f4a0')
on conflict (app_key) do update set folder_name = excluded.folder_name;
