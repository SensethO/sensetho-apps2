-- ============================================================
-- FRAMEWORK : Catégories, Apps, Permissions
-- ============================================================

-- Table catégories d'applications
create table if not exists public.app_categories (
  id            uuid default gen_random_uuid() primary key,
  name          text not null,
  slug          text not null unique,
  description   text,
  icon          text default 'grid',
  order_index   int not null default 0,
  is_admin_only boolean not null default false,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Table applications
create table if not exists public.apps (
  id            uuid default gen_random_uuid() primary key,
  name          text not null,
  slug          text not null unique,
  description   text,
  icon          text default 'app',
  route         text not null,
  category_id   uuid references public.app_categories(id) on delete set null,
  order_index   int not null default 0,
  is_active     boolean not null default true,
  is_admin_only boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Table permissions utilisateur par app
create table if not exists public.user_app_permissions (
  user_id    uuid references auth.users(id) on delete cascade,
  app_id     uuid references public.apps(id) on delete cascade,
  can_access boolean not null default true,
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id),
  primary key (user_id, app_id)
);

-- RLS
alter table public.app_categories enable row level security;
alter table public.apps enable row level security;
alter table public.user_app_permissions enable row level security;

-- Politiques app_categories : lecture pour tous les connectés
create policy "Lecture catégories"
  on public.app_categories for select
  using (auth.uid() is not null);

create policy "Gestion catégories (admin)"
  on public.app_categories for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Politiques apps : lecture pour tous les connectés
create policy "Lecture apps"
  on public.apps for select
  using (auth.uid() is not null);

create policy "Gestion apps (admin)"
  on public.apps for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Politiques user_app_permissions
create policy "Lecture permissions personnelles"
  on public.user_app_permissions for select
  using (auth.uid() = user_id);

create policy "Gestion permissions (admin)"
  on public.user_app_permissions for all
  using (exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'));

-- Triggers updated_at
create or replace trigger app_categories_updated_at
  before update on public.app_categories
  for each row execute procedure public.set_updated_at();

create or replace trigger apps_updated_at
  before update on public.apps
  for each row execute procedure public.set_updated_at();

-- ============================================================
-- SEED : catégorie Administration + 2 apps admin
-- ============================================================

insert into public.app_categories (name, slug, description, icon, order_index, is_admin_only)
values ('Administration', 'administration', 'Outils d''administration du portail', 'shield', 999, true)
on conflict (slug) do nothing;

insert into public.apps (name, slug, description, icon, route, category_id, order_index, is_admin_only)
values
  ('Catégories', 'admin-categories', 'Gérer les catégories et l''ordre des applications', 'tag', '/admin/categories',
   (select id from public.app_categories where slug = 'administration'), 1, true),
  ('Droits d''accès', 'admin-permissions', 'Gérer les droits d''accès aux applications par utilisateur', 'key', '/admin/permissions',
   (select id from public.app_categories where slug = 'administration'), 2, true)
on conflict (slug) do nothing;
