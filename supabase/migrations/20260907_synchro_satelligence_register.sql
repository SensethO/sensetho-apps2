-- ══════════════════════════════════════════════════════════════════════════════
-- Synchro Satelligence — Enregistrement dans le catalogue des apps
-- À appliquer APRÈS 20260907_satelligence_credentials.sql
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_biz_cat_id uuid;
BEGIN
  -- ─── Catégorie "Business" (cherche par slug, crée si absent) ───────────────
  SELECT id INTO v_biz_cat_id FROM app_categories WHERE slug = 'business' LIMIT 1;

  IF v_biz_cat_id IS NULL THEN
    INSERT INTO app_categories (name, slug, description, icon, order_index, is_admin_only, is_active, shell_type)
    VALUES ('Business', 'business', 'Applications métier', 'barChart', 30, false, true, 'standard')
    RETURNING id INTO v_biz_cat_id;
  END IF;

  -- ─── App Synchro Satelligence ──────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM apps WHERE slug = 'synchro-satelligence') THEN
    INSERT INTO apps (
      name, slug, description, icon, route,
      category_id, order_index, is_active, is_admin_only,
      is_for_sale, pricing_type
    ) VALUES (
      'Synchro Satelligence',
      'synchro-satelligence',
      'Interconnexion du SI T&S avec la plateforme Satelligence (risque déforestation) via son API',
      'satellite',
      '/business/synchro-satelligence',
      v_biz_cat_id, 25, true, false,
      true, 'subscription'
    );
  END IF;
END $$;
