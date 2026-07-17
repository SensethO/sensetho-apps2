-- CRM relation fournisseurs/acheteurs : contacts multiples, prochaine action (relance
-- programmée) + échéance, responsable de la relation. (statut + follow_ups déjà présents)
alter table eudr_suppliers
  add column if not exists contacts         jsonb not null default '[]'::jsonb,
  add column if not exists next_action      text,
  add column if not exists next_action_date date,
  add column if not exists owner            text;

alter table eudr_buyers
  add column if not exists contacts         jsonb not null default '[]'::jsonb,
  add column if not exists next_action      text,
  add column if not exists next_action_date date,
  add column if not exists owner            text;
