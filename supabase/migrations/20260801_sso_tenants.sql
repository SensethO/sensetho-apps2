-- Annuaire des tenants Microsoft Entra autorisés à se connecter en SSO.
--
-- Le SSO est déclaré multi-tenant côté Entra : sans filtre, n'importe quel
-- utilisateur d'un annuaire Microsoft dans le monde pourrait créer un compte.
-- Cette table est la liste blanche, et elle est administrée depuis l'application.

create table if not exists public.sso_tenants (
  id            uuid primary key default gen_random_uuid(),
  -- Identifiant d'annuaire Entra : c'est le claim `tid` du jeton, la seule
  -- valeur non falsifiable qui désigne l'organisation d'origine.
  tenant_id     uuid not null unique,
  nom           text not null,
  -- Domaines de messagerie rattachés. Indicatif : l'autorisation porte sur le
  -- tenant, pas sur le domaine, qu'un annuaire peut ajouter ou retirer.
  domaines      text[] not null default '{}',
  -- Organisation de la plateforme à rattacher automatiquement aux comptes créés.
  org_id        uuid references public.organisations(id) on delete set null,
  actif         boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now()
);

create index if not exists sso_tenants_actif_idx on public.sso_tenants (actif) where actif;

alter table public.sso_tenants enable row level security;

-- Seuls les administrateurs voient et modifient la liste blanche. Les routes
-- serveur passent par le service_role, qui contourne RLS.
drop policy if exists sso_tenants_admin on public.sso_tenants;
create policy sso_tenants_admin on public.sso_tenants
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Tenant d'origine du compte, relevé à la première connexion SSO. Permet de
-- refuser l'accès à un utilisateur dont le tenant a été désactivé après coup,
-- ce que le contrôle à la création ne couvre pas.
alter table public.profiles add column if not exists sso_tenant_id uuid;

create or replace function public.sso_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists sso_tenants_touch on public.sso_tenants;
create trigger sso_tenants_touch before update on public.sso_tenants
  for each row execute function public.sso_touch_updated_at();

-- Autorisation d'un tenant. En security definer pour être appelable depuis le
-- hook d'authentification, qui s'exécute sans contexte utilisateur.
create or replace function public.sso_tenant_autorise(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.sso_tenants t
    where t.tenant_id = p_tenant_id and t.actif
  );
$$;

revoke all on function public.sso_tenant_autorise(uuid) from public, anon, authenticated;
grant execute on function public.sso_tenant_autorise(uuid) to service_role, supabase_auth_admin;
