-- Renommage demandé le 2026-08-30 : « Projet RSE » devient « Plan Stratégique ».
-- Le slug et la route restent projet-rse (aucune rupture de liens/abonnements).
UPDATE apps SET name = 'Plan Stratégique'
  WHERE slug = 'projet-rse';
-- ROLLBACK : UPDATE apps SET name = 'Projet RSE' WHERE slug = 'projet-rse';
