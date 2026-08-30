-- L'app admin-sso (créée le 2026-08-01) réutilisait la clé d'icône « shieldCheck »,
-- déjà portée par secure-score-m365 avant sa bascule en emoji — doublon réintroduit
-- après le dédoublonnage du 2026-07-13. « lock » est libre et parle de lui-même.
UPDATE apps SET icon = 'lock' WHERE slug = 'admin-sso' AND icon = 'shieldCheck';
-- ROLLBACK : UPDATE apps SET icon = 'shieldCheck' WHERE slug = 'admin-sso';
