-- Conservation probante des fichiers EUDR : versions suffixées, immuabilité, journal.
--
-- Contexte réglementaire : le règlement (UE) 2023/1115 impose (art. 33) de conserver
-- cinq ans la documentation de diligence raisonnée. Une déclaration déposée doit
-- donc pouvoir être rattachée, des années plus tard, au fichier EXACT qui l'a
-- alimentée — ce qui interdit d'écraser, de renommer ou de supprimer un fichier.
--
-- Décision (2026-09-01) : le dépôt passe exclusivement par l'application, jamais
-- par SharePoint en direct. L'application peut donc imposer le nom, et le nom
-- devient une donnée probante plutôt qu'un libellé de confort.

-- ── 1. Versions ──────────────────────────────────────────────────────────────
-- Chaque dépôt d'un fichier de même base crée une version NOUVELLE ; aucune n'est
-- jamais remplacée. Nom SharePoint : « {base}__v{NNN}{extension} ».
alter table public.eudr_attachments
  add column if not exists base_name   text,
  add column if not exists version_num integer,
  add column if not exists sp_path     text;

comment on column public.eudr_attachments.base_name is
  'Nom de base commun à toutes les versions d''un même document (sans suffixe __vNNN ni extension).';
comment on column public.eudr_attachments.version_num is
  'Numéro de version, attribué par le serveur. Null pour les fichiers antérieurs au 2026-09-01.';
comment on column public.eudr_attachments.sp_path is
  'Chemin SharePoint complet au dépôt, figé. Sert au contrôle d''intégrité (le fichier est-il toujours là où il a été déposé, sous le nom qu''on lui a donné).';

create index if not exists eudr_attachments_base_idx
  on public.eudr_attachments (org_id, entity_type, entity_id, base_name, version_num desc);

-- ── 2. Retrait logique, jamais de suppression ────────────────────────────────
-- Retirer un document le masque de l'usage courant sans détruire ni le fichier ni
-- sa trace. La suppression physique n'est plus offerte par aucune route.
alter table public.eudr_attachments
  add column if not exists retire_le     timestamptz,
  add column if not exists retire_par    uuid references auth.users(id) on delete set null,
  add column if not exists retire_motif  text;

comment on column public.eudr_attachments.retire_le is
  'Retrait logique : le document reste sur SharePoint et en base, mais sort de l''usage courant.';

create index if not exists eudr_attachments_actifs_idx
  on public.eudr_attachments (org_id, entity_type, entity_id) where retire_le is null;

-- ── 3. Nom du fichier figé dans la déclaration ───────────────────────────────
-- `geojson_attachment_id` pointe, `geojson_sha256` prouve, `geojson_nom` se lit.
-- Les trois sont nécessaires : un identifiant ne se lit pas dans un dossier
-- d'audit, et une empreinte ne dit pas de quel fichier elle est l'empreinte.
alter table public.eudr_dds
  add column if not exists geojson_nom text;

comment on column public.eudr_dds.geojson_nom is
  'Nom versionné du fichier transmis (« X__v003.geojson »), figé au dépôt pour rester lisible même si tout le reste évolue.';

-- ── 4. Journal des mouvements de fichiers ────────────────────────────────────
-- Append-only : aucune route n'expose de mise à jour ni de suppression, et la
-- politique RLS n'autorise que la lecture. Les écritures passent par le service
-- role, côté serveur.
create table if not exists public.eudr_fichiers_journal (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.organisations(id) on delete cascade,
  attachment_id uuid references public.eudr_attachments(id) on delete set null,
  -- Nom et version recopiés : le journal doit rester lisible même si la ligne
  -- d'attachement disparaît un jour (cascade d'une organisation supprimée).
  nom           text,
  version_num   integer,
  evenement     text not null check (evenement in (
                  'depot',              -- nouvelle version déposée depuis l'application
                  'versement',          -- entrée au référentiel des parcelles
                  'retrait_referentiel',-- sortie du périmètre courant au profit d'une autre version
                  'depot_dds',          -- transmis à TRACES dans une déclaration
                  'retrait_logique',    -- masqué de l'usage courant, fichier conservé
                  'renommage_technique',-- intervention exceptionnelle, motif obligatoire
                  'suppression_refusee' -- tentative de suppression ou de renommage bloquée
                )),
  detail        jsonb,
  sha256        text,
  acteur        uuid references auth.users(id) on delete set null,
  cree_le       timestamptz not null default now()
);

create index if not exists eudr_fichiers_journal_org_idx
  on public.eudr_fichiers_journal (org_id, cree_le desc);
create index if not exists eudr_fichiers_journal_att_idx
  on public.eudr_fichiers_journal (attachment_id, cree_le);

alter table public.eudr_fichiers_journal enable row level security;

-- Lecture seule (même portée que eudr_attachments) ; aucune policy d'écriture,
-- de mise à jour ni de suppression : le journal ne se corrige pas. Les écritures
-- passent par le service role, côté serveur.
drop policy if exists eudr_fichiers_journal_select on public.eudr_fichiers_journal;
create policy eudr_fichiers_journal_select on public.eudr_fichiers_journal for select
  using (
    exists (select 1 from organisations o where o.id = org_id and o.user_id = auth.uid())
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ROLLBACK :
-- drop table if exists public.eudr_fichiers_journal;
-- alter table public.eudr_attachments drop column if exists base_name, drop column if exists version_num,
--   drop column if exists sp_path, drop column if exists retire_le, drop column if exists retire_par,
--   drop column if exists retire_motif;
-- alter table public.eudr_dds drop column if exists geojson_nom;
