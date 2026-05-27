-- ══════════════════════════════════════════════════════════════════════════════
-- AgriTracker — Enregistrement dans le catalogue des apps
-- À appliquer APRÈS 20260527_agri_tracker_full.sql
-- ══════════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_biz_cat_id  uuid;
  v_admin_cat_id uuid;
  v_agri_app_id  uuid;
BEGIN

  -- ─── Catégorie "Business" (cherche par slug, crée si absent) ───────────────
  SELECT id INTO v_biz_cat_id
  FROM app_categories WHERE slug = 'business' LIMIT 1;

  IF v_biz_cat_id IS NULL THEN
    INSERT INTO app_categories (name, slug, description, icon, order_index, is_admin_only, is_active, shell_type)
    VALUES ('Business', 'business', 'Applications métier', 'barChart', 30, false, true, 'standard')
    RETURNING id INTO v_biz_cat_id;
  END IF;

  -- ─── App AgriTracker ───────────────────────────────────────────────────────
  SELECT id INTO v_agri_app_id
  FROM apps WHERE slug = 'agri-tracker' LIMIT 1;

  IF v_agri_app_id IS NULL THEN
    INSERT INTO apps (
      name, slug, description, icon, route,
      category_id, order_index, is_active, is_admin_only,
      is_for_sale, pricing_type
    ) VALUES (
      'AgriTracker',
      'agri-tracker',
      'Suivi de plantation, météo, photos terrain et CRM acheteur/vendeur',
      'app',
      '/business/agri-tracker',
      v_biz_cat_id, 20, true, false,
      true, 'subscription'
    );
  END IF;

  -- ─── Catégorie admin (cherche ou crée) ─────────────────────────────────────
  SELECT id INTO v_admin_cat_id
  FROM app_categories WHERE slug = 'admin' AND is_admin_only = true LIMIT 1;

  IF v_admin_cat_id IS NULL THEN
    SELECT id INTO v_admin_cat_id
    FROM app_categories WHERE is_admin_only = true ORDER BY order_index LIMIT 1;
  END IF;

  -- ─── Lien admin Droits AgriTracker (si catégorie admin trouvée) ────────────
  IF v_admin_cat_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM apps WHERE slug = 'admin-agri-roles') THEN
      INSERT INTO apps (
        name, slug, description, icon, route,
        category_id, order_index, is_active, is_admin_only,
        is_for_sale, pricing_type
      ) VALUES (
        'Droits AgriTracker',
        'admin-agri-roles',
        'Gérer les rôles Planteur / Acheteur des utilisateurs',
        'shield',
        '/admin/agri-roles',
        v_admin_cat_id, 50, true, true,
        false, 'free'
      );
    END IF;
  END IF;

END $$;
