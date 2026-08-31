-- Empreinte du GeoJSON réellement transmis à TRACES lors du dépôt.
--
-- Pourquoi : `eudr_dds.geojson_attachment_id` ne fige qu'un POINTEUR vers le
-- fichier. Si le contenu du fichier change sur SharePoint après le dépôt (mise à
-- jour du même document, hors du flux de correction de l'application), le
-- pointeur reste valide et le contrôle a posteriori conclut « conforme » alors
-- que la déclaration ne porte plus les géométries du fichier courant.
--
-- L'empreinte porte sur le GeoJSON APRÈS assainissement (éclatement des
-- MultiPolygon, suppression des trous, arrondi, simplification optionnelle),
-- c'est-à-dire sur les octets effectivement transmis — pas sur le fichier brut.
-- `geojson_simplify` mémorise le réglage utilisé, sans quoi la comparaison
-- ultérieure serait faite avec un assainissement différent et signalerait un
-- faux écart.
--
-- Les DDS déposées avant cette migration ont une empreinte nulle : le contrôle
-- de contenu se tait pour elles (il ne présume pas d'un écart qu'il ne peut pas
-- établir), et le contrôle de version continue de s'appliquer.
alter table public.eudr_dds
  add column if not exists geojson_sha256   text,
  add column if not exists geojson_simplify boolean;

comment on column public.eudr_dds.geojson_sha256 is
  'SHA-256 (hex) du GeoJSON assaini transmis à TRACES au dépôt. Null pour les dépôts antérieurs au 2026-08-31.';
comment on column public.eudr_dds.geojson_simplify is
  'Réglage de simplification utilisé au dépôt, à rejouer pour toute comparaison ultérieure.';

-- ROLLBACK :
-- alter table public.eudr_dds drop column if exists geojson_sha256, drop column if exists geojson_simplify;
