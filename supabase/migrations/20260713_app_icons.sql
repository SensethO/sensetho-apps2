-- Icônes spécifiques et uniques par application (demande du 2026-07-13).
-- Apps du catalogue : emoji distinctif (rendu texte par CatalogueClient et,
-- depuis ce jour, par le composant Icon qui tolère les emoji).
-- Apps Administration : clés SVG du composant Icon (dédoublonnées).
-- Corrige aussi 2 icônes corrompues ('??') et le tiret cassé du nom de Board.

-- ── RSE ──────────────────────────────────────────────────────────────────────
UPDATE apps SET icon = '🩺' WHERE slug = 'diagnostic-initial';  -- était shieldCheck (doublon)
UPDATE apps SET icon = '🦺' WHERE slug = 'iso45001';            -- était corrompu '??'
UPDATE apps SET icon = '🔗' WHERE slug = 'vigilance';           -- était clé 'shield'
UPDATE apps SET icon = '🍃' WHERE slug = 'ecovadis';            -- était clé 'leaf'
UPDATE apps SET icon = '🏆' WHERE slug = 'afnor-rse';           -- était clé 'award'
UPDATE apps SET icon = '📢' WHERE slug = 'green-claims';        -- était 🌿 (icône de la catégorie RSE)
UPDATE apps SET icon = '🌳' WHERE slug = 'eudr';                -- était clé 'tree'
UPDATE apps SET icon = '📊' WHERE slug = 'vsme-efrag';          -- était clé 'barChart'
UPDATE apps SET icon = '👥' WHERE slug = 'parties-prenantes';   -- était clé 'users'
UPDATE apps SET icon = '🪞' WHERE slug = 'le-miroir';           -- était clé 'eye'
UPDATE apps SET icon = '⏱️' WHERE slug = 'gestion-temps';       -- était clé 'clock'
-- inchangées (déjà uniques) : bilan-ges 🏭, collecte-rse 🗂️, act-carbone 🌱,
-- bcorp 🏅, gpsr 🛡️, iso50001 ⚡, iso53001 🎯, afaq26000 🎖️, label-nr 💻,
-- iso26000 🔍, odd-iso26000 🌍, sapin2 ⚖️, rapport-integre 📄

-- ── Business / Métier / Collaboration ────────────────────────────────────────
UPDATE apps SET icon = '🚚' WHERE slug = 'eudr-fournisseurs';       -- était corrompu '??'
UPDATE apps SET icon = '🏢' WHERE slug = 'gestion-organisations';   -- était clé 'building'
UPDATE apps SET icon = '🚜' WHERE slug = 'agri-tracker';            -- était clé générique 'app'
UPDATE apps SET icon = '📋' WHERE slug = 'board';                   -- était clé 'layout'
UPDATE apps SET icon = '🔐' WHERE slug = 'secure-score-m365';       -- était shieldCheck (doublon)
-- inchangée : strategie-partagee 🧭

-- ── Administration (clés SVG, dédoublonnage) ─────────────────────────────────
UPDATE apps SET icon = 'star' WHERE slug = 'admin-vente';           -- était 'tag' (doublon admin-categories)

-- ── Correction encodage nom Board (mojibake UTF-8→cp1252) ────────────────────
UPDATE apps SET name = 'Board — Tableau collaboratif' WHERE slug = 'board' AND name LIKE 'Board â%';

-- ROLLBACK (valeurs antérieures) :
-- UPDATE apps SET icon = 'shieldCheck' WHERE slug IN ('diagnostic-initial','secure-score-m365');
-- UPDATE apps SET icon = 'shield' WHERE slug = 'vigilance'; ... (voir git blame de ce fichier)
