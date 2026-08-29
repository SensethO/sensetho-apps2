-- Taille totale du schéma public, en octets.
-- Alimente l'indicateur de volume réellement hébergé publié sur la page
-- /hebergement-responsable (src/lib/impactMetrics.ts). Sans cette fonction,
-- la page affiche les autres indicateurs et omet simplement la taille.
create or replace function public.public_schema_size_bytes()
returns bigint
language sql
security definer
set search_path = public, pg_catalog
as $fn$
  select coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r';
$fn$;

-- Réservé au service role (jamais exposé aux clients anon/authenticated).
revoke all on function public.public_schema_size_bytes() from public, anon, authenticated;
grant execute on function public.public_schema_size_bytes() to service_role;
