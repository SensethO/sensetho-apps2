-- Amorçage de la liste blanche avec l'annuaire Sens'ethO.
--
-- Sans cette entrée, la vérification refuserait toute connexion SSO — y compris
-- celle de l'administrateur venu ajouter le premier tenant. On évite ainsi une
-- impasse, plutôt que d'ouvrir un mode permissif tant que la liste est vide.
insert into public.sso_tenants (tenant_id, nom, domaines, actif, notes)
values (
  '56de879c-d3d0-4bb3-8230-35477d85a1f0',
  'Sens''ethO (SCDB PRO SARL)',
  array['sensetho.com', 'scdbpro.onmicrosoft.com'],
  true,
  'Annuaire d''origine de la plateforme. Porte aussi le tenant SharePoint.'
)
on conflict (tenant_id) do nothing;
