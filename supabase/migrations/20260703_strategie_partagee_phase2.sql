-- Stratégie Partagée — Phase 2 « Déployer » : matrice Hoshin d'alignement,
-- Balanced Scorecard, Master Plan. Stockés sur la même ligne (JSONB).
alter table strategie_partagee
  add column if not exists hoshin      jsonb not null default '{}'::jsonb,
  add column if not exists bsc         jsonb not null default '{}'::jsonb,
  add column if not exists master_plan jsonb not null default '[]'::jsonb;
