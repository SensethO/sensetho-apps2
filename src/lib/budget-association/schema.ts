// Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget) — adapté plateforme sensetho-apps2.
// Ne pas éditer sans reporter au Catalogue-App.
//
// Schéma SQL du module « Budget association » (Postgres / Supabase).
// La copie APPLIQUÉE en production est la migration
// supabase/migrations/20260713_budget_association.sql (schéma identique
// + insertion de l'app dans le catalogue). Garder les deux synchronisés.
//
// Adaptations plateforme : structure_id → organisations(id) ; table budget_actions ;
// budget_is_admin() lisant profiles.role ; RLS multi-tenant sur budget_exercices.
export const BUDGET_SCHEMA_SQL = String.raw`-- ═══════════════════════════════════════════════════════════════
-- App « Budget association » — comptabilité associative (PCG loi 1901)
-- Vendorisé depuis @sensetho/catalogue-app v0.5.10 (src/budget/schema.ts)
-- Adapté plateforme sensetho-apps2 :
--   • structure_id → FK organisations(id) (pas de table structures) ;
--   • table budget_actions (pas de table actions) ;
--   • budget_is_admin() lisant profiles.role (pas user_metadata) ;
--   • RLS multi-tenant : écriture exercices = propriétaire d'organisation OU admin.
-- Idempotent — ré-exécutable sans effet de bord.
-- Ne pas éditer sans reporter au Catalogue-App.
-- ═══════════════════════════════════════════════════════════════

-- ── Fonction budget_is_admin() (rôle dans public.profiles) ──────

create or replace function public.budget_is_admin() returns boolean
language sql security definer stable
set search_path = public
as $fn$
  select coalesce(
    (select p.role from public.profiles p where p.id = auth.uid()) = 'admin',
    false
  );
$fn$;

-- ── Tables ───────────────────────────────────────────────────

create table if not exists budget_comptes (
  id          uuid    primary key default gen_random_uuid(),
  numero      text    not null unique,
  libelle     text    not null,
  type        text    not null check (type in ('charge','produit')),
  parent_id   uuid    references budget_comptes(id) on delete set null,
  sort_order  int     not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Actions (projets) porteuses de sous-budgets — table minimale plateforme.
create table if not exists budget_actions (
  id              uuid    primary key default gen_random_uuid(),
  organisation_id uuid    references organisations(id) on delete cascade,
  nom             text    not null,
  statut          text    not null default 'en_cours',
  date_debut      date,
  date_fin        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists budget_exercices (
  id            uuid    primary key default gen_random_uuid(),
  nom           text    not null,
  date_debut    date    not null,
  date_fin      date    not null,
  statut        text    not null default 'ouvert' check (statut in ('ouvert','cloture','archive')),
  notes         text,
  structure_id  uuid    references organisations(id) on delete set null,  -- « structure » = organisation
  deleted_at    timestamptz,             -- corbeille admin (soft delete)
  deleted_by    uuid    references auth.users(id),
  created_at    timestamptz not null default now(),
  created_by    uuid    references auth.users(id) on delete set null,
  updated_at    timestamptz not null default now(),
  updated_by    uuid    references auth.users(id) on delete set null
);

create table if not exists budget_lignes (
  id                        uuid    primary key default gen_random_uuid(),
  exercice_id               uuid    not null references budget_exercices(id) on delete cascade,
  compte_id                 uuid    not null references budget_comptes(id) on delete restrict,
  affectation_type          text    not null default 'fonctionnement'
                                    check (affectation_type in ('fonctionnement','action')),
  action_id                 uuid    references budget_actions(id) on delete set null,
  montant_previsionnel      decimal(12,2) not null default 0,
  montant_realise           decimal(12,2) not null default 0,
  notes                     text,
  contribue_budget_general  boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id) on delete set null
);

create table if not exists budget_lignes_details (
  id                    uuid    primary key default gen_random_uuid(),
  ligne_id              uuid    not null references budget_lignes(id) on delete cascade,
  commentaire           text    not null default '',
  montant_previsionnel  decimal(12,2) not null default 0,
  montant_realise       decimal(12,2) not null default 0,
  sort_order            int     not null default 0,
  action_poste_id       uuid,   -- UUID libre (pas de table action_postes sur la plateforme)
  qonto_transaction_id  text,   -- anti-doublon d'import bancaire
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists budget_modifications (
  id              uuid    primary key default gen_random_uuid(),
  ligne_id        uuid    not null references budget_lignes(id) on delete cascade,
  champ           text    not null,
  ancienne_valeur text,
  nouvelle_valeur text,
  motif           text,
  modified_at     timestamptz not null default now(),
  modified_by     uuid references auth.users(id) on delete set null
);

create table if not exists budget_permissions (
  id           uuid    primary key default gen_random_uuid(),
  user_id      uuid    not null references auth.users(id) on delete cascade,
  exercice_id  uuid    references budget_exercices(id) on delete cascade,
  compte_type  text    check (compte_type in ('charge','produit')),
  niveau       text    not null check (niveau in ('lecture','ecriture')),
  created_at   timestamptz not null default now(),
  unique (user_id, exercice_id, compte_type)
);

create table if not exists budget_pieces (
  id                  uuid    primary key default gen_random_uuid(),
  ligne_id            uuid    references budget_lignes(id) on delete cascade,
  detail_id           uuid    references budget_lignes_details(id) on delete cascade,
  nom                 text    not null,
  sharepoint_item_id  text,   -- item ID Microsoft Graph (module sharepoint)
  url                 text,
  type_piece          text    check (type_piece in ('facture','devis','contrat','autre')),
  montant             decimal(12,2),
  date_piece          date,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create table if not exists budget_reports (
  id               uuid    primary key default gen_random_uuid(),
  from_exercice_id uuid    not null references budget_exercices(id) on delete cascade,
  to_exercice_id   uuid    references budget_exercices(id) on delete set null,
  affectation_type text    not null check (affectation_type in ('fonctionnement','action')),
  action_id        uuid    references budget_actions(id) on delete set null,
  montant          decimal(12,2) not null default 0,
  notes            text,
  created_by       uuid    references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ── Index ────────────────────────────────────────────────────

create index if not exists idx_budget_comptes_parent      on budget_comptes(parent_id);
create index if not exists idx_budget_actions_org         on budget_actions(organisation_id);
create index if not exists idx_budget_exercices_structure on budget_exercices(structure_id);
create index if not exists idx_budget_lignes_exercice     on budget_lignes(exercice_id);
create index if not exists idx_budget_lignes_compte       on budget_lignes(compte_id);
create index if not exists idx_budget_lignes_action       on budget_lignes(action_id);
create index if not exists idx_budget_details_ligne       on budget_lignes_details(ligne_id);
create index if not exists idx_bld_action_poste_id        on budget_lignes_details(action_poste_id);
create index if not exists idx_budget_mods_ligne          on budget_modifications(ligne_id);
create index if not exists idx_budget_perms_user          on budget_permissions(user_id);
create index if not exists idx_budget_reports_from        on budget_reports(from_exercice_id);
create index if not exists idx_budget_reports_to          on budget_reports(to_exercice_id);
create index if not exists idx_budget_reports_action      on budget_reports(action_id);

-- Unicité des lignes : un index partiel par type d'affectation
-- (NULL != NULL en Postgres — une contrainte UNIQUE classique laisserait
-- passer des doublons de lignes « fonctionnement »).
create unique index if not exists idx_budget_lignes_uniq_fonct
  on budget_lignes (exercice_id, compte_id)
  where affectation_type = 'fonctionnement';
create unique index if not exists idx_budget_lignes_uniq_action
  on budget_lignes (exercice_id, compte_id, action_id)
  where affectation_type = 'action';

-- Anti-doublon d'import bancaire
create unique index if not exists idx_bld_qonto_tx
  on budget_lignes_details(qonto_transaction_id)
  where qonto_transaction_id is not null;

-- ── Trigger updated_at ───────────────────────────────────────

create or replace function budget_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_budget_exercices_updated_at on budget_exercices;
create trigger set_budget_exercices_updated_at
  before update on budget_exercices for each row execute function budget_set_updated_at();

drop trigger if exists set_budget_lignes_updated_at on budget_lignes;
create trigger set_budget_lignes_updated_at
  before update on budget_lignes for each row execute function budget_set_updated_at();

drop trigger if exists set_budget_details_updated_at on budget_lignes_details;
create trigger set_budget_details_updated_at
  before update on budget_lignes_details for each row execute function budget_set_updated_at();

drop trigger if exists set_budget_actions_updated_at on budget_actions;
create trigger set_budget_actions_updated_at
  before update on budget_actions for each row execute function budget_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

alter table budget_comptes        enable row level security;
alter table budget_actions        enable row level security;
alter table budget_exercices      enable row level security;
alter table budget_lignes         enable row level security;
alter table budget_lignes_details enable row level security;
alter table budget_modifications  enable row level security;
alter table budget_permissions    enable row level security;
alter table budget_pieces         enable row level security;
alter table budget_reports        enable row level security;

-- Plan comptable : lecture authentifiée, écriture admin uniquement
drop policy if exists "budget_comptes_select" on budget_comptes;
create policy "budget_comptes_select" on budget_comptes for select to authenticated using (true);
drop policy if exists "budget_comptes_admin" on budget_comptes;
create policy "budget_comptes_admin"  on budget_comptes for all to authenticated
  using (budget_is_admin()) with check (budget_is_admin());

-- Exercices : lecture authentifiée ; écriture = propriétaire de l'organisation OU admin
drop policy if exists "budget_exercices_select" on budget_exercices;
create policy "budget_exercices_select" on budget_exercices for select to authenticated using (true);
drop policy if exists "budget_exercices_admin" on budget_exercices;
drop policy if exists "budget_exercices_write" on budget_exercices;
create policy "budget_exercices_write" on budget_exercices for all to authenticated
  using (
    budget_is_admin()
    or exists (
      select 1 from organisations o
      where o.id = budget_exercices.structure_id and o.user_id = auth.uid()
    )
  )
  with check (
    budget_is_admin()
    or exists (
      select 1 from organisations o
      where o.id = budget_exercices.structure_id and o.user_id = auth.uid()
    )
  );

-- Actions, lignes, détails, modifs, permissions, pièces, reports : authentifiés
-- (les permissions fines budget_permissions sont gérées côté application)
do $$ declare t text;
begin
  foreach t in array array[
    'budget_actions','budget_lignes','budget_lignes_details','budget_modifications',
    'budget_permissions','budget_pieces','budget_reports'
  ] loop
    execute format('drop policy if exists "%s_auth" on %I', t, t);
    execute format(
      'create policy "%s_auth" on %I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      t, t
    );
  end loop;
end $$;

-- ── Plan comptable PCG associations loi 1901 (seed) ──────────

-- CHARGES
insert into budget_comptes (numero, libelle, type, parent_id, sort_order) values
  ('60',   'Achats',                                              'charge', null, 10),
  ('601',  'Achats d''études et de prestations de services',      'charge', (select id from budget_comptes where numero='60'), 11),
  ('602',  'Achats non stockés de matières et fournitures',       'charge', (select id from budget_comptes where numero='60'), 12),
  ('606',  'Fournitures non stockables (eau, énergie)',           'charge', (select id from budget_comptes where numero='60'), 13),
  ('6063', 'Fournitures d''entretien et de petit équipement',     'charge', (select id from budget_comptes where numero='60'), 14),
  ('6068', 'Autres fournitures',                                  'charge', (select id from budget_comptes where numero='60'), 15),

  ('61',   'Services extérieurs',                                 'charge', null, 20),
  ('611',  'Sous-traitance générale',                             'charge', (select id from budget_comptes where numero='61'), 21),
  ('612',  'Locations',                                           'charge', (select id from budget_comptes where numero='61'), 22),
  ('615',  'Entretien et réparation',                             'charge', (select id from budget_comptes where numero='61'), 23),
  ('616',  'Assurance',                                           'charge', (select id from budget_comptes where numero='61'), 24),
  ('618',  'Documentation',                                       'charge', (select id from budget_comptes where numero='61'), 25),
  ('619',  'Divers services extérieurs',                          'charge', (select id from budget_comptes where numero='61'), 26),

  ('62',   'Autres services extérieurs',                          'charge', null, 30),
  ('621',  'Rémunérations intermédiaires et honoraires',          'charge', (select id from budget_comptes where numero='62'), 31),
  ('623',  'Publicité, publication',                              'charge', (select id from budget_comptes where numero='62'), 32),
  ('625',  'Déplacements, missions',                              'charge', (select id from budget_comptes where numero='62'), 33),
  ('626',  'Frais postaux et de télécommunications',              'charge', (select id from budget_comptes where numero='62'), 34),
  ('627',  'Services bancaires, autres',                          'charge', (select id from budget_comptes where numero='62'), 35),
  ('628',  'Divers autres services extérieurs',                   'charge', (select id from budget_comptes where numero='62'), 36),

  ('63',   'Impôts et taxes',                                     'charge', null, 40),
  ('631',  'Impôts et taxes sur rémunération',                    'charge', (select id from budget_comptes where numero='63'), 41),
  ('637',  'Autres impôts et taxes',                              'charge', (select id from budget_comptes where numero='63'), 42),

  ('64',   'Charges de personnel',                                'charge', null, 50),
  ('641',  'Rémunération des personnels',                         'charge', (select id from budget_comptes where numero='64'), 51),
  ('645',  'Charges sociales',                                    'charge', (select id from budget_comptes where numero='64'), 52),
  ('648',  'Autres charges de personnel',                         'charge', (select id from budget_comptes where numero='64'), 53),

  ('65',   'Autres charges de gestion courante',                  'charge', null, 60),
  ('66',   'Charges financières',                                 'charge', null, 70),
  ('67',   'Charges exceptionnelles',                             'charge', null, 80),
  ('68',   'Dotations aux amortissements et provisions',          'charge', null, 90),

  ('86',   'Emplois des contributions volontaires en nature',     'charge', null, 100),
  ('860',  'Secours en nature',                                   'charge', (select id from budget_comptes where numero='86'), 101),
  ('861',  'Mise à disposition gratuite de biens et prestations', 'charge', (select id from budget_comptes where numero='86'), 102),
  ('862',  'Personnel bénévole',                                  'charge', (select id from budget_comptes where numero='86'), 103)
on conflict (numero) do nothing;

-- PRODUITS
insert into budget_comptes (numero, libelle, type, parent_id, sort_order) values
  ('70',   'Ventes de produits finis, prestations de services',   'produit', null, 10),
  ('706',  'Prestations de services',                             'produit', (select id from budget_comptes where numero='70'), 11),
  ('707',  'Ventes de marchandises',                              'produit', (select id from budget_comptes where numero='70'), 12),
  ('708',  'Produits des activités annexes',                      'produit', (select id from budget_comptes where numero='70'), 13),

  ('74',   'Subventions d''exploitation',                         'produit', null, 20),
  ('7411', 'Subvention État (ANS, ARS, ...)',                     'produit', (select id from budget_comptes where numero='74'), 21),
  ('7412', 'Subvention Région(s)',                                'produit', (select id from budget_comptes where numero='74'), 22),
  ('7413', 'Subvention Département(s)',                           'produit', (select id from budget_comptes where numero='74'), 23),
  ('7414', 'Subvention Commune(s)',                               'produit', (select id from budget_comptes where numero='74'), 24),
  ('7415', 'Subvention CC et agglomérations',                     'produit', (select id from budget_comptes where numero='74'), 25),
  ('7416', 'Subvention organismes sociaux',                       'produit', (select id from budget_comptes where numero='74'), 26),
  ('7417', 'Subvention fédération',                               'produit', (select id from budget_comptes where numero='74'), 27),
  ('7418', 'Fonds européens',                                     'produit', (select id from budget_comptes where numero='74'), 28),
  ('7419', 'ASP',                                                 'produit', (select id from budget_comptes where numero='74'), 29),
  ('7489', 'Autres recettes',                                     'produit', (select id from budget_comptes where numero='74'), 30),

  ('75',   'Autres produits de gestion courante',                 'produit', null, 30),
  ('756',  'Cotisations',                                         'produit', (select id from budget_comptes where numero='75'), 31),
  ('757',  'Dons particuliers',                                   'produit', (select id from budget_comptes where numero='75'), 32),
  ('758',  'Mécénats d''entreprises',                             'produit', (select id from budget_comptes where numero='75'), 33),
  ('759',  'Autres produits courants',                            'produit', (select id from budget_comptes where numero='75'), 34),

  ('76',   'Produits financiers',                                 'produit', null, 40),
  ('77',   'Produits exceptionnels',                              'produit', null, 50),
  ('78',   'Reprises sur amortissements et provisions',           'produit', null, 60),
  ('79',   'Transferts de charges',                               'produit', null, 70),

  ('87',   'Contributions volontaires en nature',                 'produit', null, 80),
  ('870',  'Dons en nature',                                      'produit', (select id from budget_comptes where numero='87'), 81),
  ('871',  'Prestations en nature',                               'produit', (select id from budget_comptes where numero='87'), 82),
  ('875',  'Bénévolat',                                           'produit', (select id from budget_comptes where numero='87'), 83)
on conflict (numero) do nothing;
`;
