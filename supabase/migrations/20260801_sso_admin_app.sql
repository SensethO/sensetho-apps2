-- Entrée de navigation vers l'administration du SSO Microsoft.
-- La barre latérale est pilotée par la table `apps` : sans cette ligne, la page
-- existerait mais resterait introuvable.
insert into public.apps (name, slug, description, icon, route, category_id, order_index, is_active, is_admin_only, pricing_type, is_for_sale)
select
  'Connexion Microsoft',
  'admin-sso',
  'Annuaires Microsoft autorisés en SSO et suivi du secret',
  'shieldCheck',
  '/admin/sso',
  a.category_id,
  a.order_index + 1,
  true,
  true,
  'free',
  false
from public.apps a
where a.route = '/admin/sharepoint'
on conflict (slug) do nothing;
