-- Projet RSE — niveau « sous-programme » et registre d'acteurs référencés.
--
-- POURQUOI CETTE MIGRATION
--
-- 1. Le référentiel de gestion de programme compte cinq niveaux : portefeuille,
--    programme, sous-programme, projet, lot de travail. L'application n'en
--    modélisait que trois. Le sous-programme regroupe des projets qui concourent
--    au même bénéfice ; il ne produit aucun livrable propre, mais il est le
--    niveau où l'arbitrage entre projets se fait.
--
-- 2. Les parties prenantes étaient dupliquées : une ligne par projet. Une même
--    personne physique apparaissant sur cinq projets existait en cinq
--    exemplaires, et son remplacement demandait cinq modifications sans lien
--    entre elles. Le registre devient une entité de l'organisation, référencée
--    par les éléments qui la concernent — un seul enregistrement, plusieurs
--    rattachements. Toute modification est datée, motivée, et reportée dans le
--    fil d'avancement de chaque élément rattaché.
--
-- Migration idempotente. Les données existantes de projet_rse_parties sont
-- reprises sans perte ; la table est conservée en l'état comme archive.

-- ===========================================================================
-- 1. SOUS-PROGRAMMES
-- ===========================================================================

create table if not exists projet_rse_sous_programmes (
  id             uuid primary key default gen_random_uuid(),
  programme_id   uuid not null references projet_rse_programmes(id) on delete cascade,
  code           text not null,                 -- « SP1 », « SP2 »… sert de préfixe aux projets
  nom            text not null,
  fonction       text,                          -- la fonction que ce regroupement remplit
  description    text,
  ordre          integer not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_projet_rse_sous_programmes_programme
  on projet_rse_sous_programmes(programme_id);
create unique index if not exists idx_projet_rse_sous_programmes_code
  on projet_rse_sous_programmes(programme_id, code);

alter table projet_rse_projets
  add column if not exists sous_programme_id uuid
    references projet_rse_sous_programmes(id) on delete set null;

create index if not exists idx_projet_rse_projets_sous_programme
  on projet_rse_projets(sous_programme_id);

-- ===========================================================================
-- 2. REGISTRE DES ACTEURS — une entité par partie prenante, au niveau organisation
-- ===========================================================================

create table if not exists projet_rse_acteurs (
  id                   uuid primary key default gen_random_uuid(),
  organisation_id      uuid not null references organisations(id) on delete cascade,
  nom                  text not null,
  organisation         text,                    -- entité d'appartenance (texte libre)
  -- Nature de l'acteur : une personne physique se remplace, une fonction se
  -- réattribue, un collectif se recompose. La distinction commande le
  -- traitement d'un changement.
  type                 text not null default 'entite'
                         check (type in ('personne', 'fonction', 'collectif', 'entite', 'sans_voix')),
  categorie            text not null default 'bleue'
                         check (categorie in ('verte', 'orange', 'bleue')),
  role                 text,
  pouvoir              integer not null default 3 check (pouvoir between 1 and 5),
  interet              integer not null default 3 check (interet between 1 and 5),
  legitimite           integer not null default 3 check (legitimite between 1 and 5),
  urgence              integer not null default 1 check (urgence between 1 and 5),
  attitude             text not null default 'neutre'
                         check (attitude in ('alliee', 'ouverte', 'neutre', 'vigilante', 'opposee')),
  attentes             text,
  verbatims            text,
  strategie            text,
  statut_suivi         text not null default 'a_engager'
                         check (statut_suivi in ('a_engager', 'engagee', 'a_risque', 'ok')),
  engagement_actuel    text not null default 'peu_conscient'
                         check (engagement_actuel in ('peu_conscient','resistant','neutre','solidaire','leader')),
  engagement_souhaite  text not null default 'solidaire'
                         check (engagement_souhaite in ('peu_conscient','resistant','neutre','solidaire','leader')),
  -- Un acteur retiré du registre n'est pas supprimé : ses rattachements et son
  -- historique restent lisibles.
  actif                boolean not null default true,
  legacy_partie_id     uuid,                    -- traçabilité de la reprise
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_projet_rse_acteurs_org
  on projet_rse_acteurs(organisation_id);
create unique index if not exists idx_projet_rse_acteurs_nom
  on projet_rse_acteurs(organisation_id, lower(nom));

-- ===========================================================================
-- 3. RATTACHEMENTS — un acteur, plusieurs éléments, à n'importe quel niveau
-- ===========================================================================

create table if not exists projet_rse_acteur_liens (
  id                 uuid primary key default gen_random_uuid(),
  acteur_id          uuid not null references projet_rse_acteurs(id) on delete cascade,
  portefeuille_id    uuid references projet_rse_portefeuilles(id) on delete cascade,
  programme_id       uuid references projet_rse_programmes(id) on delete cascade,
  sous_programme_id  uuid references projet_rse_sous_programmes(id) on delete cascade,
  projet_id          uuid references projet_rse_projets(id) on delete cascade,
  -- Pourquoi cet acteur est concerné par cet élément précis. C'est ce qui
  -- distingue un rattachement utile d'une liste recopiée.
  role_local         text,
  criticite          text not null default 'concernee'
                       check (criticite in ('cle', 'concernee', 'informee')),
  created_at         timestamptz not null default now(),
  -- Exactement une cible par lien.
  constraint projet_rse_acteur_liens_une_cible check (
    (case when portefeuille_id   is null then 0 else 1 end
   + case when programme_id      is null then 0 else 1 end
   + case when sous_programme_id is null then 0 else 1 end
   + case when projet_id         is null then 0 else 1 end) = 1
  )
);

create index if not exists idx_projet_rse_liens_acteur on projet_rse_acteur_liens(acteur_id);
create index if not exists idx_projet_rse_liens_projet on projet_rse_acteur_liens(projet_id);
create index if not exists idx_projet_rse_liens_sp     on projet_rse_acteur_liens(sous_programme_id);
create index if not exists idx_projet_rse_liens_prog   on projet_rse_acteur_liens(programme_id);
create index if not exists idx_projet_rse_liens_porte  on projet_rse_acteur_liens(portefeuille_id);

create unique index if not exists idx_projet_rse_liens_unique_projet
  on projet_rse_acteur_liens(acteur_id, projet_id) where projet_id is not null;
create unique index if not exists idx_projet_rse_liens_unique_sp
  on projet_rse_acteur_liens(acteur_id, sous_programme_id) where sous_programme_id is not null;
create unique index if not exists idx_projet_rse_liens_unique_prog
  on projet_rse_acteur_liens(acteur_id, programme_id) where programme_id is not null;
create unique index if not exists idx_projet_rse_liens_unique_porte
  on projet_rse_acteur_liens(acteur_id, portefeuille_id) where portefeuille_id is not null;

-- ===========================================================================
-- 4. HISTORIQUE DE L'ACTEUR — ce qui a changé, quand, et pourquoi
-- ===========================================================================

create table if not exists projet_rse_acteur_historique (
  id                uuid primary key default gen_random_uuid(),
  acteur_id         uuid not null references projet_rse_acteurs(id) on delete cascade,
  type              text not null
                      check (type in ('creation', 'modification', 'remplacement',
                                      'retrait', 'rattachement', 'detachement')),
  champ             text,
  ancienne_valeur   text,
  nouvelle_valeur   text,
  -- Le contexte du changement. Obligatoire pour un remplacement : une personne
  -- physique ne se remplace pas sans que la raison soit écrite.
  motif             text,
  auteur_id         uuid,
  created_at        timestamptz not null default now()
);

create index if not exists idx_projet_rse_acteur_historique_acteur
  on projet_rse_acteur_historique(acteur_id, created_at desc);

-- ===========================================================================
-- 5. JOURNAL — le fil d'avancement de chaque élément
-- ===========================================================================
-- Un changement d'acteur n'est pas seulement consigné dans l'historique de
-- l'acteur : il est reporté dans le fil de chaque élément rattaché, avec le
-- contexte. C'est ce qui permet, en relisant un projet, de savoir qu'un
-- interlocuteur a changé en cours de route et pour quelle raison.

create table if not exists projet_rse_journal (
  id                 uuid primary key default gen_random_uuid(),
  organisation_id    uuid not null references organisations(id) on delete cascade,
  portefeuille_id    uuid references projet_rse_portefeuilles(id) on delete cascade,
  programme_id       uuid references projet_rse_programmes(id) on delete cascade,
  sous_programme_id  uuid references projet_rse_sous_programmes(id) on delete cascade,
  projet_id          uuid references projet_rse_projets(id) on delete cascade,
  type               text not null default 'note'
                       check (type in ('acteur', 'revue', 'jalon', 'note', 'rattachement', 'structure')),
  acteur_id          uuid references projet_rse_acteurs(id) on delete set null,
  texte              text not null,
  auteur_id          uuid,
  created_at         timestamptz not null default now()
);

create index if not exists idx_projet_rse_journal_projet on projet_rse_journal(projet_id, created_at desc);
create index if not exists idx_projet_rse_journal_sp     on projet_rse_journal(sous_programme_id, created_at desc);
create index if not exists idx_projet_rse_journal_prog   on projet_rse_journal(programme_id, created_at desc);
create index if not exists idx_projet_rse_journal_org    on projet_rse_journal(organisation_id, created_at desc);

-- ===========================================================================
-- 6. ENGAGEMENTS — rattachement à l'acteur plutôt qu'à la copie projet
-- ===========================================================================

alter table projet_rse_engagements
  add column if not exists acteur_id uuid references projet_rse_acteurs(id) on delete cascade;

-- partie_id devient facultatif : les nouveaux engagements pointent vers l'acteur.
alter table projet_rse_engagements alter column partie_id drop not null;

create index if not exists idx_projet_rse_engagements_acteur
  on projet_rse_engagements(acteur_id);

-- ===========================================================================
-- 7. REPRISE DES DONNÉES EXISTANTES
-- ===========================================================================
-- Une ligne de projet_rse_parties par projet devient un acteur unique par
-- organisation, plus un lien vers le projet d'origine. Les attributs retenus
-- sont ceux de la ligne la plus récemment mise à jour.

insert into projet_rse_acteurs (
  organisation_id, nom, organisation, categorie, role, pouvoir, interet,
  legitimite, urgence, attitude, attentes, verbatims, strategie, statut_suivi,
  engagement_actuel, engagement_souhaite, legacy_partie_id, type)
select distinct on (pr.organisation_id, lower(pp.nom))
  pr.organisation_id, pp.nom, pp.organisation, pp.categorie, pp.role, pp.pouvoir,
  pp.interet, pp.legitimite, pp.urgence, pp.attitude, pp.attentes, pp.verbatims,
  pp.strategie, pp.statut_suivi, pp.engagement_actuel, pp.engagement_souhaite,
  pp.id,
  case
    when pp.nom ~ '^[A-ZÉÈÀÂÎÔÛ][a-zéèêàâîôûç]+ [A-ZÉÈÀÂÎÔÛ]' then 'personne'
    when pp.categorie = 'orange' then 'fonction'
    when lower(pp.nom) in ('la terre', 'générations futures') then 'sans_voix'
    else 'entite'
  end
from projet_rse_parties pp
join projet_rse_projets pr on pr.id = pp.projet_id
order by pr.organisation_id, lower(pp.nom), pp.updated_at desc
on conflict do nothing;

-- Un lien par ligne d'origine, vers son projet.
insert into projet_rse_acteur_liens (acteur_id, projet_id, role_local, criticite)
select a.id, pp.projet_id, pp.role,
       case when pp.pouvoir >= 4 or pp.statut_suivi = 'a_risque' then 'cle' else 'concernee' end
from projet_rse_parties pp
join projet_rse_projets pr on pr.id = pp.projet_id
join projet_rse_acteurs a
  on a.organisation_id = pr.organisation_id and lower(a.nom) = lower(pp.nom)
on conflict do nothing;

-- Les engagements suivent leur acteur.
update projet_rse_engagements e
set acteur_id = a.id
from projet_rse_parties pp
join projet_rse_projets pr on pr.id = pp.projet_id
join projet_rse_acteurs a
  on a.organisation_id = pr.organisation_id and lower(a.nom) = lower(pp.nom)
where e.partie_id = pp.id and e.acteur_id is null;

-- Trace de la reprise dans l'historique de chaque acteur créé.
insert into projet_rse_acteur_historique (acteur_id, type, motif)
select a.id, 'creation',
       'Repris du registre par projet lors du passage au registre d''organisation, le 30 août 2026.'
from projet_rse_acteurs a
where a.legacy_partie_id is not null
  and not exists (select 1 from projet_rse_acteur_historique h
                  where h.acteur_id = a.id and h.type = 'creation');

-- ===========================================================================
-- 8. TRIGGERS updated_at
-- ===========================================================================

drop trigger if exists trg_projet_rse_sous_programmes_updated_at on projet_rse_sous_programmes;
create trigger trg_projet_rse_sous_programmes_updated_at
  before update on projet_rse_sous_programmes
  for each row execute function projet_rse_set_updated_at();

drop trigger if exists trg_projet_rse_acteurs_updated_at on projet_rse_acteurs;
create trigger trg_projet_rse_acteurs_updated_at
  before update on projet_rse_acteurs
  for each row execute function projet_rse_set_updated_at();

-- ===========================================================================
-- 9. RLS — propriétaire de l'organisation ou administrateur
-- ===========================================================================

alter table projet_rse_sous_programmes    enable row level security;
alter table projet_rse_acteurs            enable row level security;
alter table projet_rse_acteur_liens       enable row level security;
alter table projet_rse_acteur_historique  enable row level security;
alter table projet_rse_journal            enable row level security;

-- Sous-programmes : par le programme puis l'organisation.
drop policy if exists projet_rse_sous_programmes_all on projet_rse_sous_programmes;
create policy projet_rse_sous_programmes_all on projet_rse_sous_programmes for all
  using (
    exists (select 1 from projet_rse_programmes pg
            join organisations o on o.id = pg.organisation_id
            where pg.id = projet_rse_sous_programmes.programme_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from projet_rse_programmes pg
            join organisations o on o.id = pg.organisation_id
            where pg.id = projet_rse_sous_programmes.programme_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists projet_rse_acteurs_all on projet_rse_acteurs;
create policy projet_rse_acteurs_all on projet_rse_acteurs for all
  using (
    exists (select 1 from organisations o
            where o.id = projet_rse_acteurs.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from organisations o
            where o.id = projet_rse_acteurs.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists projet_rse_acteur_liens_all on projet_rse_acteur_liens;
create policy projet_rse_acteur_liens_all on projet_rse_acteur_liens for all
  using (
    exists (select 1 from projet_rse_acteurs a
            join organisations o on o.id = a.organisation_id
            where a.id = projet_rse_acteur_liens.acteur_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from projet_rse_acteurs a
            join organisations o on o.id = a.organisation_id
            where a.id = projet_rse_acteur_liens.acteur_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists projet_rse_acteur_historique_all on projet_rse_acteur_historique;
create policy projet_rse_acteur_historique_all on projet_rse_acteur_historique for all
  using (
    exists (select 1 from projet_rse_acteurs a
            join organisations o on o.id = a.organisation_id
            where a.id = projet_rse_acteur_historique.acteur_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from projet_rse_acteurs a
            join organisations o on o.id = a.organisation_id
            where a.id = projet_rse_acteur_historique.acteur_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists projet_rse_journal_all on projet_rse_journal;
create policy projet_rse_journal_all on projet_rse_journal for all
  using (
    exists (select 1 from organisations o
            where o.id = projet_rse_journal.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (
    exists (select 1 from organisations o
            where o.id = projet_rse_journal.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ===========================================================================
-- ROLLBACK
-- ===========================================================================
-- drop table if exists projet_rse_journal;
-- drop table if exists projet_rse_acteur_historique;
-- drop table if exists projet_rse_acteur_liens;
-- drop table if exists projet_rse_acteurs;
-- alter table projet_rse_projets drop column if exists sous_programme_id;
-- alter table projet_rse_engagements drop column if exists acteur_id;
-- drop table if exists projet_rse_sous_programmes;
