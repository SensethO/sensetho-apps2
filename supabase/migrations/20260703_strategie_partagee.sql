-- Stratégie Partagée (Hoshin Kanri) — document vivant unique par organisation.
-- Chaque module de la méthode est stocké en JSONB. Phase 1 « Élaborer » d'abord ;
-- les phases Déployer/Piloter réutiliseront la même ligne (colonnes ajoutées ensuite).
create table if not exists strategie_partagee (
  org_id              uuid primary key references organisations(id) on delete cascade,
  user_id             uuid not null references auth.users(id) on delete cascade,
  horizon             text,                 -- ex. "2027-2029"
  mission             jsonb not null default '{}'::jsonb,
  swot                jsonb not null default '{}'::jsonb,
  attentes            jsonb not null default '{}'::jsonb,
  vision              jsonb not null default '{}'::jsonb,
  valeurs             jsonb not null default '[]'::jsonb,
  axes                jsonb not null default '[]'::jsonb,
  strategie_activite  jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table strategie_partagee enable row level security;

drop policy if exists strategie_partagee_select on strategie_partagee;
create policy strategie_partagee_select on strategie_partagee for select
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

drop policy if exists strategie_partagee_write on strategie_partagee;
create policy strategie_partagee_write on strategie_partagee for all
  using (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    auth.uid() = user_id
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- Entrée catalogue (catégorie Business)
insert into apps (name, slug, description, icon, route, category_id, order_index, is_active, is_admin_only, pricing_type, is_for_sale)
values (
  'Stratégie Partagée (Hoshin Kanri)',
  'strategie-partagee',
  'Élaborer, déployer et piloter une stratégie partagée selon la méthode Hoshin Kanri : mission, SWOT, attentes clients (Kano), vision, valeurs, axes stratégiques et lignes d''actions, matrices d''alignement, Balanced Scorecard et Master Plan.',
  '🧭',
  '/business/strategie-partagee',
  '56924ea4-54ba-4ef0-ba16-4138ec9441af',
  0, true, false, 'quote', true
)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  route = excluded.route,
  category_id = excluded.category_id,
  updated_at = now();
