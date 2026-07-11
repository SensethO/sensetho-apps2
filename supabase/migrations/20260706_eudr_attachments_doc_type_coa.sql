-- Étend la contrainte doc_type de eudr_attachments pour autoriser les pièces
-- issues de l'analyse COA : 'coa' (certificat d'analyse source) et
-- 'client_demand' (demande client / cahier des charges).
-- Correctif du bug : new row for relation "eudr_attachments" violates check
-- constraint "eudr_attachments_doc_type_check" lors de l'analyse d'un COA.
-- Additif et résilient : rejoue sans risque (drop if exists + recreate superset).

alter table eudr_attachments
  drop constraint if exists eudr_attachments_doc_type_check;

alter table eudr_attachments
  add constraint eudr_attachments_doc_type_check
  check (doc_type in (
    'geojson', 'questionnaire', 'certificate', 'ddr', 'dds', 'other',
    'coa', 'client_demand'
  ));
