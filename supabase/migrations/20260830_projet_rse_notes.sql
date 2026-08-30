-- ---------------------------------------------------------------------------
-- Notes & documents de l’app « Plan Stratégique » (slug projet-rse).
-- Règle universelle RSE : tout item porteur d’avancement (cadrage, jalon,
-- risque…) offre un panneau Notes & documents — sections Tiptap en jsonb,
-- pièces jointes stockées dans SharePoint (jamais en base, jamais via Vercel).
-- Idempotente. Date : 2026-08-30
-- ---------------------------------------------------------------------------

create table if not exists projet_rse_notes (
  id          uuid primary key default gen_random_uuid(),
  projet_id   uuid not null references projet_rse_projets(id) on delete cascade,
  -- Clé libre de l’item porteur : 'cadrage', 'jalon_<id>', 'risque_<id>'…
  action_key  text not null,
  content     text not null default '',
  sections    jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (projet_id, action_key)
);

create index if not exists idx_projet_rse_notes_projet
  on projet_rse_notes(projet_id);

-- Compteur atomique pour le préfixe d’annexe A00x_ (pattern iso53001)
alter table projet_rse_projets
  add column if not exists attachment_counter int not null default 0;

-- Trigger updated_at (réutilise la fonction commune de l’app)
drop trigger if exists trg_projet_rse_notes_updated_at on projet_rse_notes;
create trigger trg_projet_rse_notes_updated_at
  before update on projet_rse_notes
  for each row execute function projet_rse_set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS : propriétaire de l’organisation du projet, ou admin — même patron que
-- les autres tables projet_rse_* (cf. 20260807_projet_rse.sql).
-- ---------------------------------------------------------------------------

alter table projet_rse_notes enable row level security;

drop policy if exists projet_rse_notes_all on projet_rse_notes;
create policy projet_rse_notes_all on projet_rse_notes for all
  using (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_notes.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  )
  with check (
    exists (
      select 1 from projet_rse_projets pr
      join organisations o on o.id = pr.organisation_id
      where pr.id = projet_rse_notes.projet_id and o.user_id = auth.uid()
    )
    or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  );

-- ---------------------------------------------------------------------------
-- Fonction atomique du compteur d’annexes (SECURITY DEFINER, pattern iso53001)
-- ---------------------------------------------------------------------------

create or replace function increment_projet_rse_notes_counter(p_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_counter int;
begin
  update projet_rse_projets
    set attachment_counter = attachment_counter + 1
    where id = p_id
    returning attachment_counter into v_counter;
  return v_counter;
end;
$$;
