-- Suivi des déclarations DDS déposées via l'app (vision officielle TRACES).
create table if not exists eudr_dds (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  dds_uuid text not null,
  environment text not null default 'acceptance',
  internal_reference_number text,
  reference_number text,
  verification_number text,
  status text,
  activity_type text,
  commodity text,
  net_weight numeric,
  official_date timestamptz,      -- date officielle renvoyée par TRACES
  official_updated_by text,       -- auteur officiel (updatedBy)
  form_json jsonb,                -- instantané du formulaire de dépôt (pour rouvrir/amender)
  geojson_attachment_id text,     -- document GeoJSON utilisé (pour ré-injecter à l'amend)
  submitted_by text,              -- email de l'utilisateur qui a déposé depuis l'app
  submitted_at timestamptz not null default now(),
  last_checked_at timestamptz,    -- dernière actualisation du statut via getDds
  created_at timestamptz not null default now(),
  unique (org_id, dds_uuid)
);
create index if not exists eudr_dds_org_idx on eudr_dds(org_id);
alter table eudr_dds enable row level security;
-- Accès serveur uniquement via service role (comme les autres tables EUDR) ; aucune policy publique.
