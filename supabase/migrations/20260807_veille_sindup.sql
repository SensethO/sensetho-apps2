-- App « Veille stratégique (Sindup) » — carte catalogue vers le service externe
-- app.sindup.com (iframe interdit par Sindup : X-Frame-Options sameorigin).
-- Gratuite côté plateforme (le service Sindup a sa propre tarification).
-- ⚠️ À appliquer sur le projet Supabase PARIS (pjrwjfozzynmjvbygqev).

INSERT INTO apps (name, slug, description, icon, route, category_id, pricing_type, is_for_sale, is_active)
VALUES (
  'Veille stratégique (Sindup)',
  'veille-sindup',
  'Veille stratégique et e-réputation avec Sindup : surveillance multi-sources (presse, réseaux sociaux, web), alertes ciblées, analyses de tendances et de tonalité. Service partenaire — s''ouvre dans Sindup avec votre compte.',
  '📡',
  '/business/veille-sindup',
  '56924ea4-54ba-4ef0-ba16-4138ec9441af',  -- catégorie Business
  'free',
  true,
  true
)
ON CONFLICT (slug) DO NOTHING;

-- ROLLBACK : DELETE FROM apps WHERE slug = 'veille-sindup';
