-- Projet RSE — stockage des sous-applications restantes.
--
-- Cadrage et business case durable, découpage du travail et responsabilités,
-- jalons, risques et indicateurs de projet, analyse d'impact P5, plan de
-- management de la durabilité, théorie du changement.
--
-- Deux principes de conception :
--   — tout ce qui désigne une personne pointe vers `projet_rse_acteurs`, jamais
--     vers un nom recopié : la succession d'un titulaire suit donc partout ;
--   — le plan de management de la durabilité s'attache au programme et non au
--     projet, parce qu'un plan par projet serait vingt-neuf fois le même.
--
-- Migration idempotente.

-- ===========================================================================
-- 1. CADRAGE ET BUSINESS CASE DURABLE — une fiche par projet
-- ===========================================================================
-- Les douze rubriques de la fiche de cadrage. L'incomplétude interdit le
-- démarrage : c'est la règle, et l'application la rend visible plutôt que de
-- la faire respecter par la contrainte SQL, qui bloquerait la saisie
-- progressive.

create table if not exists projet_rse_cadrage (
  projet_id           uuid primary key references projet_rse_projets(id) on delete cascade,
  finalite            text,   -- le problème traité, en une phrase
  livrable            text,   -- ce qui sera produit, et sa spécification
  capacite_visee      text,   -- ce que l'organisation saura faire ensuite
  benefice_attendu    text,   -- le bénéfice du registre auquel le projet contribue
  pilote_acteur_id    uuid references projet_rse_acteurs(id) on delete set null,
  parrain_acteur_id   uuid references projet_rse_acteurs(id) on delete set null,
  perimetre_inclus    text,
  perimetre_exclu     text,   -- écrit : c'est l'exclusion qui évite l'extension silencieuse
  dependances         text,
  charge_etp          numeric(6,2),
  origine_ressources  text check (origine_ressources is null or origine_ressources in
                        ('redeploiement', 'recrutement', 'externe', 'mixte')),
  budget_adosse       text,   -- ce qui s'adosse à une enveloppe existante
  budget_nouveau      text,   -- ce qui appelle une décision budgétaire
  justification       text,
  alternatives        text,
  criteres_succes     text,
  seuils_impact       text,
  approche            text check (approche is null or approche in
                        ('predictive', 'iterative', 'adaptative')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ===========================================================================
-- 2. DÉCOUPAGE DU TRAVAIL ET RESPONSABILITÉS
-- ===========================================================================
-- Trois niveaux : projet, lot de travail, tâche. La descente s'arrête dès
-- qu'un lot peut être confié à une personne nommée avec une échéance.

create table if not exists projet_rse_lots (
  id           uuid primary key default gen_random_uuid(),
  projet_id    uuid not null references projet_rse_projets(id) on delete cascade,
  parent_id    uuid references projet_rse_lots(id) on delete cascade,
  code         text not null,
  libelle      text not null,
  description  text,
  charge_jh    numeric(8,1),
  debut        date,
  echeance     date,
  statut       text not null default 'a_faire'
                 check (statut in ('a_faire', 'en_cours', 'accepte', 'abandonne')),
  ordre        integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_projet_rse_lots_projet on projet_rse_lots(projet_id);
create index if not exists idx_projet_rse_lots_parent on projet_rse_lots(parent_id);

-- Matrice des responsabilités : réalise, approuve, consulté, informé.
create table if not exists projet_rse_raci (
  id         uuid primary key default gen_random_uuid(),
  lot_id     uuid not null references projet_rse_lots(id) on delete cascade,
  acteur_id  uuid not null references projet_rse_acteurs(id) on delete cascade,
  role       text not null check (role in ('R', 'A', 'C', 'I')),
  created_at timestamptz not null default now()
);
create unique index if not exists idx_projet_rse_raci_unique
  on projet_rse_raci(lot_id, acteur_id, role);
create index if not exists idx_projet_rse_raci_acteur on projet_rse_raci(acteur_id);

-- ===========================================================================
-- 3. JALONS DE PROJET
-- ===========================================================================
-- Un jalon n'est pas une date, c'est une décision. Quatre attributs écrits
-- avant l'ouverture : critère, preuve, instance, conséquence.

create table if not exists projet_rse_jalons (
  id            uuid primary key default gen_random_uuid(),
  projet_id     uuid not null references projet_rse_projets(id) on delete cascade,
  libelle       text not null,
  nature        text not null default 'passage_phase'
                  check (nature in ('ferme_externe', 'gouvernance', 'passage_phase', 'conditionnel')),
  echeance      date,
  critere       text,   -- rédigé de façon binaire
  preuve        text,   -- le document ou la mesure qui atteste
  instance      text,   -- qui prononce, et jamais celui qui produit
  consequence   text,   -- y compris lorsqu'elle est nulle
  statut        text not null default 'ouvert'
                  check (statut in ('ouvert', 'franchi', 'manque', 'reporte')),
  franchi_le    date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists idx_projet_rse_jalons_projet on projet_rse_jalons(projet_id);

-- ===========================================================================
-- 4. RISQUES DE PROJET
-- ===========================================================================

create table if not exists projet_rse_risques (
  id                uuid primary key default gen_random_uuid(),
  projet_id         uuid not null references projet_rse_projets(id) on delete cascade,
  code              text,
  libelle           text not null,
  categorie         text,
  probabilite       integer not null default 3 check (probabilite between 1 and 5),
  impact            integer not null default 3 check (impact between 1 and 5),
  reponse           text not null default 'reduire'
                      check (reponse in ('eviter', 'reduire', 'transferer', 'accepter')),
  traitement        text,
  porteur_acteur_id uuid references projet_rse_acteurs(id) on delete set null,
  seuil_escalade    text,
  statut            text not null default 'ouvert'
                      check (statut in ('ouvert', 'maitrise', 'realise', 'retire')),
  motif_retrait     text,   -- un risque retiré est tracé avec son motif
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_projet_rse_risques_projet on projet_rse_risques(projet_id);

-- ===========================================================================
-- 5. INDICATEURS DE PROJET
-- ===========================================================================
-- Le niveau est obligatoire : c'est lui qui empêche de confondre une mesure
-- d'activité avec une mesure de résultat.

create table if not exists projet_rse_indicateurs (
  id                uuid primary key default gen_random_uuid(),
  projet_id         uuid not null references projet_rse_projets(id) on delete cascade,
  nom               text not null,
  mesure            text,
  niveau            text not null default 'livrable'
                      check (niveau in ('livrable', 'capacite', 'resultat', 'benefice')),
  formule           text,
  source            text,   -- condition de recevabilité
  frequence         text,
  proprietaire_acteur_id uuid references projet_rse_acteurs(id) on delete set null,
  valeur_depart     text,
  cible             text,
  tolerance         text,
  instance_saisie   text,
  obligatoire       boolean not null default false,  -- le jeu minimal de quatre
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_projet_rse_indicateurs_projet on projet_rse_indicateurs(projet_id);

-- ===========================================================================
-- 6. ANALYSE D'IMPACT P5
-- ===========================================================================
-- Une ligne par élément coté. Le référentiel des éléments est porté par le
-- code applicatif, ce qui évite de figer une nomenclature en base.
-- Règle anti-masquage : un impact très négatif ne se compense pas par un
-- impact positif ailleurs — l'application refuse l'agrégation naïve.

create table if not exists projet_rse_p5 (
  id           uuid primary key default gen_random_uuid(),
  projet_id    uuid not null references projet_rse_projets(id) on delete cascade,
  code         text not null,   -- identifiant de l'élément dans le référentiel
  note         integer not null check (note between -3 and 3),
  commentaire  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index if not exists idx_projet_rse_p5_unique on projet_rse_p5(projet_id, code);

-- ===========================================================================
-- 7. PLAN DE MANAGEMENT DE LA DURABILITÉ — au programme, pas au projet
-- ===========================================================================

create table if not exists projet_rse_smp (
  id                uuid primary key default gen_random_uuid(),
  programme_id      uuid references projet_rse_programmes(id) on delete cascade,
  projet_id         uuid references projet_rse_projets(id) on delete cascade,
  libelle           text not null,
  axe               text check (axe is null or axe in
                      ('financier', 'client', 'processus', 'apprentissage')),
  unite             text,
  valeur_depart     text,
  cible             text,
  echeance          date,
  seuil_alerte      text,
  instance_escalade text,
  frequence         text,
  proprietaire_acteur_id uuid references projet_rse_acteurs(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projet_rse_smp_une_cible check (
    (case when programme_id is null then 0 else 1 end
   + case when projet_id    is null then 0 else 1 end) = 1)
);
create index if not exists idx_projet_rse_smp_prog on projet_rse_smp(programme_id);
create index if not exists idx_projet_rse_smp_projet on projet_rse_smp(projet_id);

-- ===========================================================================
-- 8. THÉORIE DU CHANGEMENT ET RETOUR SOCIAL
-- ===========================================================================

create table if not exists projet_rse_impact_social (
  projet_id          uuid primary key references projet_rse_projets(id) on delete cascade,
  besoin             text,
  activites          text,
  extrants           text,
  resultats          text,
  impacts            text,
  hypotheses         text,   -- ce qui doit être vrai pour que la chaîne tienne
  sroi_investissement numeric(14,2),
  sroi_valeur        numeric(14,2),
  sroi_methode       text,   -- sans méthode écrite, un ratio ne vaut rien
  boucles            text,   -- apprentissages et réorientations
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ===========================================================================
-- 9. TRIGGERS updated_at
-- ===========================================================================

do $$
declare t text;
begin
  foreach t in array array['projet_rse_cadrage','projet_rse_lots','projet_rse_jalons',
                           'projet_rse_risques','projet_rse_indicateurs','projet_rse_p5',
                           'projet_rse_smp','projet_rse_impact_social']
  loop
    execute format('drop trigger if exists trg_%s_updated_at on %I', t, t);
    execute format('create trigger trg_%s_updated_at before update on %I
                    for each row execute function projet_rse_set_updated_at()', t, t);
  end loop;
end $$;

-- ===========================================================================
-- 10. RLS — propriétaire de l'organisation ou administrateur
-- ===========================================================================
-- Les tables rattachées à un projet partagent la même politique ; celles
-- rattachées à un lot ou à un programme remontent d'un cran.

do $$
declare t text;
begin
  foreach t in array array['projet_rse_cadrage','projet_rse_lots','projet_rse_jalons',
                           'projet_rse_risques','projet_rse_indicateurs','projet_rse_p5',
                           'projet_rse_impact_social']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists %s_all on %I', t, t);
    execute format($f$create policy %s_all on %I for all
      using (exists (select 1 from projet_rse_projets pr
                     join organisations o on o.id = pr.organisation_id
                     where pr.id = %I.projet_id and o.user_id = auth.uid())
             or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
      with check (exists (select 1 from projet_rse_projets pr
                     join organisations o on o.id = pr.organisation_id
                     where pr.id = %I.projet_id and o.user_id = auth.uid())
             or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))$f$,
      t, t, t, t);
  end loop;
end $$;

alter table projet_rse_raci enable row level security;
drop policy if exists projet_rse_raci_all on projet_rse_raci;
create policy projet_rse_raci_all on projet_rse_raci for all
  using (exists (select 1 from projet_rse_lots l
                 join projet_rse_projets pr on pr.id = l.projet_id
                 join organisations o on o.id = pr.organisation_id
                 where l.id = projet_rse_raci.lot_id and o.user_id = auth.uid())
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from projet_rse_lots l
                 join projet_rse_projets pr on pr.id = l.projet_id
                 join organisations o on o.id = pr.organisation_id
                 where l.id = projet_rse_raci.lot_id and o.user_id = auth.uid())
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

alter table projet_rse_smp enable row level security;
drop policy if exists projet_rse_smp_all on projet_rse_smp;
create policy projet_rse_smp_all on projet_rse_smp for all
  using (exists (select 1 from projet_rse_programmes pg
                 join organisations o on o.id = pg.organisation_id
                 where pg.id = projet_rse_smp.programme_id and o.user_id = auth.uid())
         or exists (select 1 from projet_rse_projets pr
                 join organisations o on o.id = pr.organisation_id
                 where pr.id = projet_rse_smp.projet_id and o.user_id = auth.uid())
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from projet_rse_programmes pg
                 join organisations o on o.id = pg.organisation_id
                 where pg.id = projet_rse_smp.programme_id and o.user_id = auth.uid())
         or exists (select 1 from projet_rse_projets pr
                 join organisations o on o.id = pr.organisation_id
                 where pr.id = projet_rse_smp.projet_id and o.user_id = auth.uid())
         or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ===========================================================================
-- 11. DETTE SOLDÉE — l'ancienne table des parties prenantes par projet
-- ===========================================================================
-- Reprise dans projet_rse_acteurs le 30 août 2026, plus écrite depuis.
-- La colonne partie_id des engagements devient sans objet.

alter table projet_rse_engagements drop column if exists partie_id;
drop table if exists projet_rse_parties;

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- drop table if exists projet_rse_impact_social, projet_rse_smp, projet_rse_p5,
--   projet_rse_indicateurs, projet_rse_risques, projet_rse_jalons,
--   projet_rse_raci, projet_rse_lots, projet_rse_cadrage;
