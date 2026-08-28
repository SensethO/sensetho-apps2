-- Projet RSE : app plus business que spécifiquement RSE (décision 2026-08-07)
-- → catégorie Business + route /business/projet-rse (redirection depuis /rse/projet-rse).
-- Appliquée en production le 2026-08-07.
UPDATE apps SET category_id = '56924ea4-54ba-4ef0-ba16-4138ec9441af', route = '/business/projet-rse'
WHERE slug = 'projet-rse';
-- ROLLBACK : UPDATE apps SET category_id = '4d65b2fe-7c6a-4878-ad74-0eee704d9dd6', route = '/rse/projet-rse' WHERE slug = 'projet-rse';
