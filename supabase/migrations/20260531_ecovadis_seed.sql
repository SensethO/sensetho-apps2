-- Enregistrement de l'app EcoVadis dans le catalogue
INSERT INTO public.apps (name, slug, description, icon, route, category_id, order_index, is_active, pricing_type, is_admin_only)
SELECT
  'EcoVadis Diagnostic',
  'ecovadis-diagnostic',
  'Preparez et ameliorez votre score EcoVadis : auto-evaluation sur 4 themes RSE, plan actions documente et preuves SharePoint.',
  'leaf',
  '/rse/ecovadis',
  id,
  60,
  true,
  'subscription',
  false
FROM public.app_categories
WHERE slug = 'rse'
LIMIT 1
ON CONFLICT (slug) DO UPDATE
  SET name        = EXCLUDED.name,
      description = EXCLUDED.description,
      route       = EXCLUDED.route,
      is_active   = true
RETURNING id, name, slug, route;
