-- Réorganisation : alignement du slug catalogue EcoVadis sur le code.
-- Le code (routes /api/ecovadis, tables ecovadis_*, composant) utilise « ecovadis » ;
-- seul le catalogue portait « ecovadis-diagnostic ». Les abonnements référencent
-- l'app par id → aucun impact. Les appKeys SharePoint 'ecovadis-diagnostic'
-- (sp_app_routes) sont indépendantes du slug et NE CHANGENT PAS.
--
-- ⚠️ À appliquer en même temps que le déploiement du commit qui change
--    RequireSubscription/RseAppShell appSlug et le check d'abonnement.
--
-- ROLLBACK :
--   update apps set slug = 'ecovadis-diagnostic' where slug = 'ecovadis';

update apps set slug = 'ecovadis', updated_at = now() where slug = 'ecovadis-diagnostic';
