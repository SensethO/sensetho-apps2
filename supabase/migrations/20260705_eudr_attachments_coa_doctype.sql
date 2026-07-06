-- Autorise les types de documents COA dans eudr_attachments (contrainte CHECK).
alter table eudr_attachments drop constraint if exists eudr_attachments_doc_type_check;
alter table eudr_attachments add constraint eudr_attachments_doc_type_check
  check (doc_type = any (array['geojson','questionnaire','certificate','ddr','dds','coa','client_demand','other']));

-- Autorise l'entité « coa » (en plus de supplier/contract).
alter table eudr_attachments drop constraint if exists eudr_attachments_entity_type_check;
alter table eudr_attachments add constraint eudr_attachments_entity_type_check
  check (entity_type = any (array['supplier','contract','coa']));
