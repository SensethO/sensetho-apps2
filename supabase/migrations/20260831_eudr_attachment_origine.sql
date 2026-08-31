-- Lien entre un fichier de géolocalisation et sa version corrigée.
--
-- La correction automatique ne remplace pas le fichier d'origine : elle dépose
-- un second fichier « X (corrigé).geojson » et un second attachement. Deux
-- identifiants décrivent donc les mêmes terres. Sans lien explicite, verser
-- successivement l'original puis sa version corrigée laisse les deux jeux de
-- parcelles dans le périmètre courant : les mêmes surfaces sont comptées deux
-- fois, et le contrôle du seuil de 4 hectares porte sur un référentiel faux —
-- exactement le double comptage que le tri reproche aux fichiers défectueux.
--
-- `corrige_de` porte ce lien. Le code sait s'en passer : à défaut de colonne, il
-- rapproche les deux versions par leur nom, qu'il construit lui-même. Cette
-- migration remplace une convention de nommage par un fait consigné.
--
-- Idempotente : rejouable sans effet de bord.

alter table public.eudr_attachments
  add column if not exists corrige_de uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.eudr_attachments'::regclass
      and conname = 'eudr_attachments_corrige_de_fkey'
  ) then
    alter table public.eudr_attachments
      add constraint eudr_attachments_corrige_de_fkey
      foreign key (corrige_de) references public.eudr_attachments(id) on delete set null;
  end if;
end $$;

-- Lecture dans le sens utile : « ce fichier a-t-il une version corrigée ? »
create index if not exists eudr_attachments_corrige_de_idx
  on public.eudr_attachments (corrige_de) where corrige_de is not null;

comment on column public.eudr_attachments.corrige_de is
  'Attachement d''origine dont celui-ci est la version corrigée. Nul pour un fichier reçu en l''état. '
  'Sert à ne jamais laisser les deux versions du même fichier au périmètre courant du référentiel.';

-- Reprise des versions corrigées déjà déposées, identifiées par leur nom
-- déterministe : le lien existait déjà en fait, il n'était pas écrit.
update public.eudr_attachments c
set corrige_de = o.id
from public.eudr_attachments o
where c.corrige_de is null
  and c.doc_type = 'geojson'
  and o.doc_type = 'geojson'
  and c.org_id = o.org_id
  and c.id <> o.id
  and o.name !~* '\(corrigé\)'
  -- Même règle de nommage que la route de correction, à la lettre.
  and c.name = regexp_replace(o.name, '\.(?:geojson|json)$', '', 'i')
               || ' (corrigé)'
               || coalesce((regexp_match(o.name, '\.(?:geojson|json)$', 'i'))[1], '.geojson');
