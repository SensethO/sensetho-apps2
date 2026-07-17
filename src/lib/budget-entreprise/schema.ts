// Dérivé du module budget-association (vendorisé depuis @sensetho/catalogue-app v0.5.10)
// — variante ENTREPRISE, adaptée plateforme sensetho-apps2.
//
// Schéma SQL du module « Budget entreprise » (Postgres / Supabase).
// La copie APPLIQUÉE en production est la migration
// supabase/migrations/20260714_budget_entreprise.sql (schéma identique
// + insertion de l'app dans le catalogue). Garder les deux synchronisés.
//
// Différences vs budget-association :
// - tables préfixées budget_ent_ ;
// - comptes typés 'charge' | 'produit' | 'actif' | 'passif' (plan comptable général, classes 1 à 7) ;
// - centres de coût (budget_ent_centres_cout) au lieu des actions ;
// - affectation_type 'general' | 'centre_cout' + colonne centre_cout_id.
export const BUDGET_ENT_SCHEMA_SQL = String.raw`-- ═══════════════════════════════════════════════════════════════
-- App « Budget entreprise » — comptabilité d'entreprise (plan comptable général)
-- Dérivé du module budget-association (@sensetho/catalogue-app v0.5.10)
-- Adapté plateforme sensetho-apps2 :
--   • structure_id → FK organisations(id) ;
--   • centres de coût (budget_ent_centres_cout) au lieu des actions ;
--   • comptes typés charge/produit/actif/passif (compte de résultat + bilan) ;
--   • budget_is_admin() RÉUTILISÉE (créée par budget-association, profiles.role) ;
--   • RLS multi-tenant : écriture exercices = propriétaire d'organisation OU admin.
-- Idempotent — ré-exécutable sans effet de bord.
-- ═══════════════════════════════════════════════════════════════

-- ── Fonction budget_is_admin() — réutilisée, créée seulement si absente ──

do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'budget_is_admin'
  ) then
    execute $fn$
      create function public.budget_is_admin() returns boolean
      language sql security definer stable
      set search_path = public
      as $body$
        select coalesce(
          (select p.role from public.profiles p where p.id = auth.uid()) = 'admin',
          false
        );
      $body$
    $fn$;
  end if;
end $$;

-- ── Tables ───────────────────────────────────────────────────

create table if not exists budget_ent_comptes (
  id          uuid    primary key default gen_random_uuid(),
  numero      text    not null unique,
  libelle     text    not null,
  type        text    not null check (type in ('charge','produit','actif','passif')),
  parent_id   uuid    references budget_ent_comptes(id) on delete set null,
  sort_order  int     not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Centres de coût porteurs de sous-budgets — remplacent les « actions ».
create table if not exists budget_ent_centres_cout (
  id              uuid    primary key default gen_random_uuid(),
  organisation_id uuid    references organisations(id) on delete cascade,
  code            text,
  nom             text    not null,
  statut          text    not null default 'actif',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists budget_ent_exercices (
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

create table if not exists budget_ent_lignes (
  id                        uuid    primary key default gen_random_uuid(),
  exercice_id               uuid    not null references budget_ent_exercices(id) on delete cascade,
  compte_id                 uuid    not null references budget_ent_comptes(id) on delete restrict,
  affectation_type          text    not null default 'general'
                                    check (affectation_type in ('general','centre_cout')),
  centre_cout_id            uuid    references budget_ent_centres_cout(id) on delete set null,
  montant_previsionnel      decimal(12,2) not null default 0,
  montant_realise           decimal(12,2) not null default 0,
  notes                     text,
  contribue_budget_general  boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  updated_by                uuid references auth.users(id) on delete set null
);

create table if not exists budget_ent_lignes_details (
  id                    uuid    primary key default gen_random_uuid(),
  ligne_id              uuid    not null references budget_ent_lignes(id) on delete cascade,
  commentaire           text    not null default '',
  montant_previsionnel  decimal(12,2) not null default 0,
  montant_realise       decimal(12,2) not null default 0,
  sort_order            int     not null default 0,
  action_poste_id       uuid,   -- UUID libre (traçabilité, pas de table dédiée)
  qonto_transaction_id  text,   -- anti-doublon d'import bancaire
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create table if not exists budget_ent_modifications (
  id              uuid    primary key default gen_random_uuid(),
  ligne_id        uuid    not null references budget_ent_lignes(id) on delete cascade,
  champ           text    not null,
  ancienne_valeur text,
  nouvelle_valeur text,
  motif           text,
  modified_at     timestamptz not null default now(),
  modified_by     uuid references auth.users(id) on delete set null
);

create table if not exists budget_ent_permissions (
  id           uuid    primary key default gen_random_uuid(),
  user_id      uuid    not null references auth.users(id) on delete cascade,
  exercice_id  uuid    references budget_ent_exercices(id) on delete cascade,
  compte_type  text    check (compte_type in ('charge','produit','actif','passif')),
  niveau       text    not null check (niveau in ('lecture','ecriture')),
  created_at   timestamptz not null default now(),
  unique (user_id, exercice_id, compte_type)
);

create table if not exists budget_ent_pieces (
  id                  uuid    primary key default gen_random_uuid(),
  ligne_id            uuid    references budget_ent_lignes(id) on delete cascade,
  detail_id           uuid    references budget_ent_lignes_details(id) on delete cascade,
  nom                 text    not null,
  sharepoint_item_id  text,   -- item ID Microsoft Graph (module sharepoint)
  url                 text,
  type_piece          text    check (type_piece in ('facture','devis','contrat','autre')),
  montant             decimal(12,2),
  date_piece          date,
  created_at          timestamptz not null default now(),
  created_by          uuid references auth.users(id) on delete set null
);

create table if not exists budget_ent_reports (
  id               uuid    primary key default gen_random_uuid(),
  from_exercice_id uuid    not null references budget_ent_exercices(id) on delete cascade,
  to_exercice_id   uuid    references budget_ent_exercices(id) on delete set null,
  affectation_type text    not null check (affectation_type in ('general','centre_cout')),
  centre_cout_id   uuid    references budget_ent_centres_cout(id) on delete set null,
  montant          decimal(12,2) not null default 0,
  notes            text,
  created_by       uuid    references auth.users(id) on delete set null,
  created_at       timestamptz not null default now()
);

-- ── Index ────────────────────────────────────────────────────

create index if not exists idx_budget_ent_comptes_parent      on budget_ent_comptes(parent_id);
create index if not exists idx_budget_ent_centres_cout_org    on budget_ent_centres_cout(organisation_id);
create index if not exists idx_budget_ent_exercices_structure on budget_ent_exercices(structure_id);
create index if not exists idx_budget_ent_lignes_exercice     on budget_ent_lignes(exercice_id);
create index if not exists idx_budget_ent_lignes_compte       on budget_ent_lignes(compte_id);
create index if not exists idx_budget_ent_lignes_centre       on budget_ent_lignes(centre_cout_id);
create index if not exists idx_budget_ent_details_ligne       on budget_ent_lignes_details(ligne_id);
create index if not exists idx_beld_action_poste_id           on budget_ent_lignes_details(action_poste_id);
create index if not exists idx_budget_ent_mods_ligne          on budget_ent_modifications(ligne_id);
create index if not exists idx_budget_ent_perms_user          on budget_ent_permissions(user_id);
create index if not exists idx_budget_ent_reports_from        on budget_ent_reports(from_exercice_id);
create index if not exists idx_budget_ent_reports_to          on budget_ent_reports(to_exercice_id);
create index if not exists idx_budget_ent_reports_centre      on budget_ent_reports(centre_cout_id);

-- Unicité des lignes : un index partiel par type d'affectation
-- (NULL != NULL en Postgres — une contrainte UNIQUE classique laisserait
-- passer des doublons de lignes « général »).
create unique index if not exists idx_budget_ent_lignes_uniq_general
  on budget_ent_lignes (exercice_id, compte_id)
  where affectation_type = 'general';
create unique index if not exists idx_budget_ent_lignes_uniq_centre
  on budget_ent_lignes (exercice_id, compte_id, centre_cout_id)
  where affectation_type = 'centre_cout';

-- Anti-doublon d'import bancaire
create unique index if not exists idx_beld_qonto_tx
  on budget_ent_lignes_details(qonto_transaction_id)
  where qonto_transaction_id is not null;

-- ── Trigger updated_at ───────────────────────────────────────

create or replace function budget_ent_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_budget_ent_exercices_updated_at on budget_ent_exercices;
create trigger set_budget_ent_exercices_updated_at
  before update on budget_ent_exercices for each row execute function budget_ent_set_updated_at();

drop trigger if exists set_budget_ent_lignes_updated_at on budget_ent_lignes;
create trigger set_budget_ent_lignes_updated_at
  before update on budget_ent_lignes for each row execute function budget_ent_set_updated_at();

drop trigger if exists set_budget_ent_details_updated_at on budget_ent_lignes_details;
create trigger set_budget_ent_details_updated_at
  before update on budget_ent_lignes_details for each row execute function budget_ent_set_updated_at();

drop trigger if exists set_budget_ent_centres_cout_updated_at on budget_ent_centres_cout;
create trigger set_budget_ent_centres_cout_updated_at
  before update on budget_ent_centres_cout for each row execute function budget_ent_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

alter table budget_ent_comptes        enable row level security;
alter table budget_ent_centres_cout   enable row level security;
alter table budget_ent_exercices      enable row level security;
alter table budget_ent_lignes         enable row level security;
alter table budget_ent_lignes_details enable row level security;
alter table budget_ent_modifications  enable row level security;
alter table budget_ent_permissions    enable row level security;
alter table budget_ent_pieces         enable row level security;
alter table budget_ent_reports        enable row level security;

-- Plan comptable : lecture authentifiée, écriture admin uniquement
drop policy if exists "budget_ent_comptes_select" on budget_ent_comptes;
create policy "budget_ent_comptes_select" on budget_ent_comptes for select to authenticated using (true);
drop policy if exists "budget_ent_comptes_admin" on budget_ent_comptes;
create policy "budget_ent_comptes_admin"  on budget_ent_comptes for all to authenticated
  using (budget_is_admin()) with check (budget_is_admin());

-- Exercices : lecture authentifiée ; écriture = propriétaire de l'organisation OU admin
drop policy if exists "budget_ent_exercices_select" on budget_ent_exercices;
create policy "budget_ent_exercices_select" on budget_ent_exercices for select to authenticated using (true);
drop policy if exists "budget_ent_exercices_write" on budget_ent_exercices;
create policy "budget_ent_exercices_write" on budget_ent_exercices for all to authenticated
  using (
    budget_is_admin()
    or exists (
      select 1 from organisations o
      where o.id = budget_ent_exercices.structure_id and o.user_id = auth.uid()
    )
  )
  with check (
    budget_is_admin()
    or exists (
      select 1 from organisations o
      where o.id = budget_ent_exercices.structure_id and o.user_id = auth.uid()
    )
  );

-- Centres de coût, lignes, détails, modifs, permissions, pièces, reports : authentifiés
-- (les permissions fines budget_ent_permissions sont gérées côté application)
do $$ declare t text;
begin
  foreach t in array array[
    'budget_ent_centres_cout','budget_ent_lignes','budget_ent_lignes_details','budget_ent_modifications',
    'budget_ent_permissions','budget_ent_pieces','budget_ent_reports'
  ] loop
    execute format('drop policy if exists "%s_auth" on %I', t, t);
    execute format(
      'create policy "%s_auth" on %I for all to authenticated using (auth.uid() is not null) with check (auth.uid() is not null)',
      t, t
    );
  end loop;
end $$;

-- ── Plan comptable général (seed) ────────────────────────────
-- Deux passes : d'abord les comptes « groupes » (2 chiffres, parent null),
-- puis leurs subdivisions (les sous-requêtes de parent ne voient pas les
-- lignes insérées dans le même statement).

-- Groupes et comptes de tête
insert into budget_ent_comptes (numero, libelle, type, parent_id, sort_order) values
  -- Classe 1 — Comptes de capitaux (passif)
  ('10',   'Capital et réserves',                                  'passif',  null, 1000),
  ('11',   'Report à nouveau',                                     'passif',  null, 1100),
  ('12',   'Résultat de l''exercice',                              'passif',  null, 1200),
  ('13',   'Subventions d''investissement',                        'passif',  null, 1300),
  ('15',   'Provisions',                                           'passif',  null, 1500),
  ('16',   'Emprunts et dettes assimilées',                        'passif',  null, 1600),
  -- Classe 2 — Comptes d'immobilisations (actif)
  ('20',   'Immobilisations incorporelles',                        'actif',   null, 2000),
  ('21',   'Immobilisations corporelles',                          'actif',   null, 2100),
  ('26',   'Participations et créances rattachées',                'actif',   null, 2600),
  ('27',   'Autres immobilisations financières',                   'actif',   null, 2700),
  ('28',   'Amortissements des immobilisations',                   'actif',   null, 2800),
  -- Classe 3 — Comptes de stocks (actif)
  ('31',   'Matières premières',                                   'actif',   null, 3100),
  ('35',   'Stocks de produits',                                   'actif',   null, 3500),
  ('37',   'Stocks de marchandises',                               'actif',   null, 3700),
  -- Classe 4 — Comptes de tiers
  ('401',  'Fournisseurs',                                         'passif',  null, 4010),
  ('411',  'Clients',                                              'actif',   null, 4110),
  ('421',  'Personnel — rémunérations dues',                       'passif',  null, 4210),
  ('431',  'Sécurité sociale',                                     'passif',  null, 4310),
  ('444',  'État — impôt sur les bénéfices',                       'passif',  null, 4440),
  ('4456', 'TVA déductible',                                       'actif',   null, 4456),
  ('4457', 'TVA collectée',                                        'passif',  null, 4457),
  ('467',  'Autres comptes débiteurs ou créditeurs',               'actif',   null, 4670),
  -- Classe 5 — Comptes financiers
  ('512',  'Banques',                                              'actif',   null, 5120),
  ('519',  'Concours bancaires courants',                          'passif',  null, 5190),
  ('53',   'Caisse',                                               'actif',   null, 5300),
  -- Classe 6 — Comptes de charges
  ('60',   'Achats',                                               'charge',  null, 6000),
  ('61',   'Services extérieurs',                                  'charge',  null, 6100),
  ('62',   'Autres services extérieurs',                           'charge',  null, 6200),
  ('63',   'Impôts, taxes et versements assimilés',                'charge',  null, 6300),
  ('64',   'Charges de personnel',                                 'charge',  null, 6400),
  ('65',   'Autres charges de gestion courante',                   'charge',  null, 6500),
  ('66',   'Charges financières',                                  'charge',  null, 6600),
  ('67',   'Charges exceptionnelles',                              'charge',  null, 6700),
  ('68',   'Dotations aux amortissements et provisions',           'charge',  null, 6800),
  ('69',   'Impôt sur les bénéfices',                              'charge',  null, 6900),
  -- Classe 7 — Comptes de produits
  ('70',   'Ventes de produits fabriqués, prestations, marchandises', 'produit', null, 7000),
  ('71',   'Production stockée',                                   'produit', null, 7100),
  ('72',   'Production immobilisée',                               'produit', null, 7200),
  ('74',   'Subventions d''exploitation',                          'produit', null, 7400),
  ('75',   'Autres produits de gestion courante',                  'produit', null, 7500),
  ('76',   'Produits financiers',                                  'produit', null, 7600),
  ('77',   'Produits exceptionnels',                               'produit', null, 7700),
  ('78',   'Reprises sur amortissements et provisions',            'produit', null, 7800),
  ('79',   'Transferts de charges',                                'produit', null, 7900)
on conflict (numero) do nothing;

-- Subdivisions (enfants des groupes ci-dessus)
insert into budget_ent_comptes (numero, libelle, type, parent_id, sort_order) values
  -- Classe 1
  ('101',  'Capital',                                              'passif',  (select id from budget_ent_comptes where numero='10'), 1010),
  ('106',  'Réserves',                                             'passif',  (select id from budget_ent_comptes where numero='10'), 1060),
  ('108',  'Compte de l''exploitant',                              'passif',  (select id from budget_ent_comptes where numero='10'), 1080),
  ('164',  'Emprunts auprès des établissements de crédit',         'passif',  (select id from budget_ent_comptes where numero='16'), 1640),
  ('168',  'Autres emprunts et dettes assimilées',                 'passif',  (select id from budget_ent_comptes where numero='16'), 1680),
  -- Classe 2
  ('205',  'Concessions, brevets, licences, logiciels',            'actif',   (select id from budget_ent_comptes where numero='20'), 2050),
  ('207',  'Fonds commercial',                                     'actif',   (select id from budget_ent_comptes where numero='20'), 2070),
  ('211',  'Terrains',                                             'actif',   (select id from budget_ent_comptes where numero='21'), 2110),
  ('213',  'Constructions',                                        'actif',   (select id from budget_ent_comptes where numero='21'), 2130),
  ('215',  'Installations techniques, matériel et outillage',      'actif',   (select id from budget_ent_comptes where numero='21'), 2150),
  ('218',  'Autres immobilisations corporelles',                   'actif',   (select id from budget_ent_comptes where numero='21'), 2180),
  -- Classe 6
  ('601',  'Achats de matières premières',                         'charge',  (select id from budget_ent_comptes where numero='60'), 6010),
  ('602',  'Achats d''autres approvisionnements',                  'charge',  (select id from budget_ent_comptes where numero='60'), 6020),
  ('604',  'Achats d''études et de prestations de services',       'charge',  (select id from budget_ent_comptes where numero='60'), 6040),
  ('606',  'Achats non stockés de matières et fournitures',        'charge',  (select id from budget_ent_comptes where numero='60'), 6060),
  ('607',  'Achats de marchandises',                               'charge',  (select id from budget_ent_comptes where numero='60'), 6070),
  ('611',  'Sous-traitance générale',                              'charge',  (select id from budget_ent_comptes where numero='61'), 6110),
  ('613',  'Locations',                                            'charge',  (select id from budget_ent_comptes where numero='61'), 6130),
  ('615',  'Entretien et réparations',                             'charge',  (select id from budget_ent_comptes where numero='61'), 6150),
  ('616',  'Primes d''assurance',                                  'charge',  (select id from budget_ent_comptes where numero='61'), 6160),
  ('618',  'Documentation et divers',                              'charge',  (select id from budget_ent_comptes where numero='61'), 6180),
  ('621',  'Personnel extérieur à l''entreprise',                  'charge',  (select id from budget_ent_comptes where numero='62'), 6210),
  ('622',  'Rémunérations d''intermédiaires et honoraires',        'charge',  (select id from budget_ent_comptes where numero='62'), 6220),
  ('623',  'Publicité, publications, relations publiques',         'charge',  (select id from budget_ent_comptes where numero='62'), 6230),
  ('625',  'Déplacements, missions et réceptions',                 'charge',  (select id from budget_ent_comptes where numero='62'), 6250),
  ('626',  'Frais postaux et de télécommunications',               'charge',  (select id from budget_ent_comptes where numero='62'), 6260),
  ('627',  'Services bancaires et assimilés',                      'charge',  (select id from budget_ent_comptes where numero='62'), 6270),
  ('628',  'Divers autres services extérieurs',                    'charge',  (select id from budget_ent_comptes where numero='62'), 6280),
  ('641',  'Rémunérations du personnel',                           'charge',  (select id from budget_ent_comptes where numero='64'), 6410),
  ('645',  'Charges de sécurité sociale et de prévoyance',         'charge',  (select id from budget_ent_comptes where numero='64'), 6450),
  ('647',  'Autres charges sociales',                              'charge',  (select id from budget_ent_comptes where numero='64'), 6470),
  -- Classe 7
  ('701',  'Ventes de produits finis',                             'produit', (select id from budget_ent_comptes where numero='70'), 7010),
  ('706',  'Prestations de services',                              'produit', (select id from budget_ent_comptes where numero='70'), 7060),
  ('707',  'Ventes de marchandises',                               'produit', (select id from budget_ent_comptes where numero='70'), 7070),
  ('708',  'Produits des activités annexes',                       'produit', (select id from budget_ent_comptes where numero='70'), 7080)
on conflict (numero) do nothing;
`;
