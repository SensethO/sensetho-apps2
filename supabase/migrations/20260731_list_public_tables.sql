-- Liste des tables du schéma public, utilisée par l'export de sauvegarde vers SharePoint
-- (src/lib/backupToSharepoint.ts) pour rester exhaustif quand le schéma évolue.
create or replace function public.list_public_tables()
returns table(table_name text, row_estimate bigint)
language sql
security definer
set search_path = public, pg_catalog
as $fn$
  select c.relname::text, coalesce(s.n_live_tup, 0)::bigint
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  left join pg_stat_user_tables s on s.relid = c.oid
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$fn$;

-- Réservé au service role (jamais exposé aux clients anon/authenticated).
revoke all on function public.list_public_tables() from public, anon, authenticated;
grant execute on function public.list_public_tables() to service_role;
