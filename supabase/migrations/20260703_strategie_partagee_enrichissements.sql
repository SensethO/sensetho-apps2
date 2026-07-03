-- Stratégie Partagée — enrichissements issus du corpus complet AQM Conseil :
--   fcs             : Facteurs Clés de Succès + indicateurs stratégiques (arbre d'alignement)
--   carte           : carte stratégique (liens cause→effet entre indicateurs : force, durée en mois)
--   communication   : communication de la stratégie (slogan, messages clés, objections, checklist)
--   canvas          : Business Model Canvas (9 blocs) + Lean Canvas (9 blocs)
--   valeurs_collecte: récolte des valeurs (3 questions : partagées aujourd'hui / à mieux partager / pour réussir)
alter table strategie_partagee
  add column if not exists fcs              jsonb not null default '[]'::jsonb,
  add column if not exists carte            jsonb not null default '[]'::jsonb,
  add column if not exists communication    jsonb not null default '{}'::jsonb,
  add column if not exists canvas           jsonb not null default '{}'::jsonb,
  add column if not exists valeurs_collecte jsonb not null default '{}'::jsonb;
