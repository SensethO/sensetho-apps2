-- Analyse de risque déforestation EUDR (via Whisp / Open Foris) par jeu de parcelles GeoJSON.
create table if not exists eudr_deforestation (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  entity_type text,               -- 'supplier' | 'buyer' | 'contract'
  entity_id uuid,
  attachment_id uuid,             -- document GeoJSON analysé (eudr_attachments)
  source_name text,               -- nom du fichier / de la source
  analyzed_at timestamptz not null default now(),
  analyzed_by text,
  overall_risk text,              -- 'low' | 'high' | 'unknown' (agrégé sur les parcelles)
  plot_count int,
  summary jsonb,                  -- compteurs agrégés (nb low/high, disturbance_after_2020…)
  plots jsonb,                    -- [{plotId, area, unit, riskPcrop, riskAcrop, riskTimber, disturbanceAfter2020, indicators}]
  unique (org_id, attachment_id)
);
create index if not exists eudr_defor_org_idx on eudr_deforestation(org_id);
alter table eudr_deforestation enable row level security;
