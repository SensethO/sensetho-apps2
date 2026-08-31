-- Qualification des signaux de perturbation du couvert (Whisp / Open Foris).
--
-- Whisp détecte un CHANGEMENT du couvert, pas une déforestation au sens EUDR.
-- Une perturbation postérieure au 31/12/2020 peut être une récolte, une repousse,
-- un événement naturel, ou une parcelle déjà en production avant la date-butoir.
-- Conclure suppose de connaître la nature du couvert d'origine — ce que seule une
-- expertise de télédétection établit. Le tri automatique ne fait donc que désigner
-- les parcelles à instruire ; c'est cette table qui porte la conclusion humaine.
--
-- Table séparée de `eudr_deforestation` À DESSEIN : cette dernière est réécrite
-- entièrement (upsert sur org_id, attachment_id, colonne `plots` jsonb remplacée)
-- à chaque ré-analyse. Une conclusion stockée dans ce jsonb serait effacée au
-- prochain passage — or l'article 33 impose de conserver la diligence 5 ans.

create table if not exists public.eudr_signal_qualifications (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.organisations(id) on delete cascade,
  -- Fichier GeoJSON d'origine : la qualification suit la parcelle, pas l'analyse.
  attachment_id  uuid not null references public.eudr_attachments(id) on delete cascade,
  -- Identifiant de parcelle tel que renvoyé par Whisp (`plotId`), stable d'une
  -- analyse à l'autre pour un même fichier.
  plot_id        text not null,

  -- Conclusion de l'instruction :
  --   'a_instruire'            (défaut) — signal ouvert, aucune conclusion
  --   'deforestation_confirmee'         — conversion de forêt postérieure au 31/12/2020
  --   'ecartee_deja_en_production'      — parcelle en production avant la date-butoir
  --   'ecartee_repousse_ou_naturel'     — repousse, récolte ou événement naturel
  --   'ecartee_expertise_externe'       — expertise spécialisée négative
  statut         text not null default 'a_instruire',
  -- Motivation libre : une conclusion sans justification ne vaut pas diligence.
  commentaire    text,
  -- Origine de la conclusion (nom du prestataire de télédétection, rapport interne…).
  source         text,

  qualified_at   timestamptz not null default now(),
  qualified_by   text,

  -- Une seule conclusion courante par parcelle et par fichier.
  unique (org_id, attachment_id, plot_id)
);

alter table public.eudr_signal_qualifications
  drop constraint if exists eudr_signal_qualifications_statut_chk;
alter table public.eudr_signal_qualifications
  add constraint eudr_signal_qualifications_statut_chk
  check (statut in (
    'a_instruire',
    'deforestation_confirmee',
    'ecartee_deja_en_production',
    'ecartee_repousse_ou_naturel',
    'ecartee_expertise_externe'
  ));

create index if not exists eudr_signal_qual_org_idx
  on public.eudr_signal_qualifications (org_id, attachment_id);

alter table public.eudr_signal_qualifications enable row level security;

-- Même règle d'accès que le reste du module : les routes serveur passent par le
-- service_role, les lectures directes restent réservées aux membres de l'organisation.
drop policy if exists eudr_signal_qual_membre on public.eudr_signal_qualifications;
create policy eudr_signal_qual_membre on public.eudr_signal_qualifications
  for select
  using (exists (
    select 1 from public.eudr_suppliers s
    where s.org_id = eudr_signal_qualifications.org_id and s.user_id = auth.uid()
  ) or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'
  ));
