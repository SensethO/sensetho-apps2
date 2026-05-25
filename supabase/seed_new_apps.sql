-- ============================================================
-- Seed : ajout des nouvelles apps RSE dans la table apps
-- Directive Green Claims + VSME EFRAG
-- ============================================================

-- App Green Claims
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active)
SELECT
  'Diagnostic Green Claims',
  'green-claims',
  'Évaluez la conformité de vos allégations environnementales à la Directive Green Claims UE 2024/825/EU',
  'shieldCheck',
  '/rse/green-claims',
  id,
  50,
  true
FROM public.app_categories WHERE slug = 'rse'
ON CONFLICT (slug) DO NOTHING;

-- App VSME EFRAG
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active)
SELECT
  'VSME EFRAG — Standard PME',
  'vsme-efrag',
  'Évaluez votre reporting de durabilité selon le standard EFRAG pour PME non cotées. Aligné CSRD/ESRS, GRI 2021 et ISO 26000.',
  'barChart',
  '/rse/vsme-efrag',
  id,
  55,
  true
FROM public.app_categories WHERE slug = 'rse'
ON CONFLICT (slug) DO NOTHING;
