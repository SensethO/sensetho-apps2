-- Stratégie Partagée — Phase 3 « Piloter » : suivi des indicateurs (PDCA) + conduite
-- du changement (8 étapes de Kotter). Mêmes lignes, JSONB.
alter table strategie_partagee
  add column if not exists pilotage jsonb not null default '{}'::jsonb,
  add column if not exists kotter   jsonb not null default '[]'::jsonb;
