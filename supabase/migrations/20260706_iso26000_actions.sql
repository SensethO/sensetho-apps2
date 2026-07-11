-- Conformité marbre RSE pour ISO 26000 : module « Plan d'actions » assignable
-- (distinct du suivi des actions suggérées). Table <slug>_actions standard.
create table if not exists iso26000_actions (
  id            uuid primary key default gen_random_uuid(),
  diagnostic_id uuid not null references iso26000_diagnostics(id) on delete cascade,
  critere_id    text not null default 'general',
  titre         text not null,
  description   text,
  priorite      text default 'moyenne',
  statut        text default 'a_faire',
  echeance      text,
  responsable   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists iso26000_actions_diag_idx on iso26000_actions(diagnostic_id);

alter table iso26000_actions enable row level security;
drop policy if exists iso26000_actions_all on iso26000_actions;
create policy iso26000_actions_all on iso26000_actions for all
  using (exists (
    select 1 from iso26000_diagnostics d where d.id = diagnostic_id
      and (d.user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  ))
  with check (exists (
    select 1 from iso26000_diagnostics d where d.id = diagnostic_id
      and (d.user_id = auth.uid() or exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'))
  ));
