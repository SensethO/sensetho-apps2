-- Types de documents EUDR de légalité (attestations et pièces que les fournisseurs
-- doivent fournir) : titre de propriété, droit d'exploiter, autorisations, attestations,
-- code de conduite signé. Étend la contrainte doc_type de eudr_attachments (additif).
alter table eudr_attachments drop constraint if exists eudr_attachments_doc_type_check;
alter table eudr_attachments add constraint eudr_attachments_doc_type_check
  check (doc_type = any (array[
    'geojson','questionnaire','certificate','ddr','dds','coa','client_demand',
    'titre_propriete','droit_exploiter','autorisation','attestation_legalite','attestation_sociale','code_conduite',
    'other'
  ]));
