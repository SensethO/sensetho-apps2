-- ---------------------------------------------------------------------------
-- Notes & documents à tous les niveaux du Plan Stratégique (slug projet-rse).
--
-- projet_rse_notes n'était rattachable qu'à un projet : projet_id not null.
-- Or les pièces les plus structurantes ne sont pas des pièces de projet — un
-- rapport de programme, une délibération de portefeuille, la fiche d'une
-- partie prenante du registre. Elles n'avaient nulle part où se ranger.
--
-- On ouvre donc la table aux cinq niveaux, sur le patron déjà employé par
-- projet_rse_journal et projet_rse_acteur_liens : des clés facultatives et une
-- contrainte qui interdit d'en désigner deux. Aucune cible désignée signifie
-- « au niveau de l'organisation ».
--
-- Idempotente. Date : 2026-09-01
-- ---------------------------------------------------------------------------

-- ── 1. Les nouvelles cibles ────────────────────────────────────────────────

alter table projet_rse_notes
  add column if not exists organisation_id   uuid references organisations(id) on delete cascade,
  add column if not exists portefeuille_id   uuid references projet_rse_portefeuilles(id) on delete cascade,
  add column if not exists programme_id      uuid references projet_rse_programmes(id) on delete cascade,
  add column if not exists sous_programme_id uuid references projet_rse_sous_programmes(id) on delete cascade,
  add column if not exists acteur_id         uuid references projet_rse_acteurs(id) on delete cascade;

-- Reprise de l'existant : toute note actuelle porte un projet, donc une
-- organisation. On la remplit avant de rendre la colonne obligatoire.
update projet_rse_notes n
   set organisation_id = p.organisation_id
  from projet_rse_projets p
 where p.id = n.projet_id
   and n.organisation_id is null;

alter table projet_rse_notes
  alter column organisation_id set not null,
  alter column projet_id drop not null;

-- ── 2. Une cible au plus ───────────────────────────────────────────────────
-- Zéro cible = note de l'organisation. Deux cibles = incohérence, refusée.

alter table projet_rse_notes drop constraint if exists projet_rse_notes_une_cible;
alter table projet_rse_notes add constraint projet_rse_notes_une_cible check (
    (case when portefeuille_id   is null then 0 else 1 end
   + case when programme_id      is null then 0 else 1 end
   + case when sous_programme_id is null then 0 else 1 end
   + case when projet_id         is null then 0 else 1 end
   + case when acteur_id         is null then 0 else 1 end) <= 1);

-- ── 3. Unicité par cible ───────────────────────────────────────────────────
-- La contrainte d'origine unique (projet_id, action_key) reste valable : deux
-- lignes de projet_id nul ne s'y heurtent pas, PostgreSQL traitant les NULL
-- comme distincts. On ajoute donc une clé partielle par nouveau niveau.

create unique index if not exists idx_projet_rse_notes_portefeuille
  on projet_rse_notes(portefeuille_id, action_key) where portefeuille_id is not null;
create unique index if not exists idx_projet_rse_notes_programme
  on projet_rse_notes(programme_id, action_key) where programme_id is not null;
create unique index if not exists idx_projet_rse_notes_sous_programme
  on projet_rse_notes(sous_programme_id, action_key) where sous_programme_id is not null;
create unique index if not exists idx_projet_rse_notes_acteur
  on projet_rse_notes(acteur_id, action_key) where acteur_id is not null;
create unique index if not exists idx_projet_rse_notes_organisation
  on projet_rse_notes(organisation_id, action_key)
  where projet_id is null and portefeuille_id is null and programme_id is null
    and sous_programme_id is null and acteur_id is null;

create index if not exists idx_projet_rse_notes_org
  on projet_rse_notes(organisation_id);

-- ── 4. RLS : par l'organisation, comme partout ailleurs dans l'app ─────────
-- L'ancienne politique remontait au projet ; elle ne peut plus, projet_id
-- devenant facultatif. La colonne organisation_id rend la règle uniforme.

alter table projet_rse_notes enable row level security;

drop policy if exists projet_rse_notes_all on projet_rse_notes;
create policy projet_rse_notes_all on projet_rse_notes for all
  using (
    exists (select 1 from organisations o
             where o.id = projet_rse_notes.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from organisations o
             where o.id = projet_rse_notes.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ── 5. Compteur d'annexes hors projet ──────────────────────────────────────
-- Le préfixe A00x_ vient d'un compteur atomique porté par le projet. Les
-- niveaux supérieurs n'en ont pas : on en tient un par organisation.

create table if not exists projet_rse_compteurs_annexes (
  organisation_id uuid primary key references organisations(id) on delete cascade,
  valeur          int not null default 0
);

alter table projet_rse_compteurs_annexes enable row level security;

drop policy if exists projet_rse_compteurs_annexes_all on projet_rse_compteurs_annexes;
create policy projet_rse_compteurs_annexes_all on projet_rse_compteurs_annexes for all
  using (
    exists (select 1 from organisations o
             where o.id = projet_rse_compteurs_annexes.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (select 1 from organisations o
             where o.id = projet_rse_compteurs_annexes.organisation_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create or replace function increment_projet_rse_compteur_org(p_org uuid)
returns int
language plpgsql
security definer
as $$
declare
  v int;
begin
  insert into projet_rse_compteurs_annexes (organisation_id, valeur)
       values (p_org, 1)
  on conflict (organisation_id)
       do update set valeur = projet_rse_compteurs_annexes.valeur + 1
    returning valeur into v;
  return v;
end;
$$;

-- ── 6. Routage SharePoint de l'application ─────────────────────────────────
-- Aucune ligne sp_app_routes n'existait pour projet-rse : getConfigForApp
-- retombait sur la configuration par défaut. On la déclare explicitement, sur
-- la configuration par défaut du tenant, pour que le dossier de l'app soit
-- nommé et déplaçable sans toucher au code.

insert into sp_app_routes (app_key, sp_config_id, folder_name)
select 'projet-rse', c.id, 'Plan-Strategique'
  from sp_configs c
 where c.is_default = true
   and not exists (select 1 from sp_app_routes r where r.app_key = 'projet-rse')
 limit 1;
