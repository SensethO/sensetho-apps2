-- EUDR : suivi de la relation (journal daté d'interactions + statut) et champs manquants
-- de l'Excel source (commodity côté fournisseur/contrat ; origine/risque/acheteur côté contrat).

alter table eudr_suppliers
  add column if not exists commodity           text,
  add column if not exists relationship_status text,
  add column if not exists follow_ups          jsonb not null default '[]'::jsonb;

alter table eudr_buyers
  add column if not exists relationship_status text,
  add column if not exists follow_ups          jsonb not null default '[]'::jsonb;

alter table eudr_contracts
  add column if not exists commodity           text,
  add column if not exists country_origin      text,
  add column if not exists country_risk_level  text,
  add column if not exists buyer               text;
