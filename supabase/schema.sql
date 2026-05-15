-- Table profiles (liée à auth.users)
create table if not exists public.profiles (
  id         uuid references auth.users(id) on delete cascade primary key,
  email      text not null,
  full_name  text,
  avatar_url text,
  role       text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Row Level Security
alter table public.profiles enable row level security;

create policy "Lecture profil personnel"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Lecture tous profils (admin)"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Mise à jour profil personnel"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Mise à jour tous profils (admin)"
  on public.profiles for update
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Suppression (admin)"
  on public.profiles for delete
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger : créer le profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    case when new.email = 'sylvain.cassaro@sensetho.com' then 'admin' else 'user' end
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger : updated_at automatique
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace trigger profiles_updated_at
  before update on public.profiles
  for each row execute procedure public.set_updated_at();
