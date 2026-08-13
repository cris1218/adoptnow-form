-- Possíveis adotantes (leads do formulário web)
-- Rode no SQL Editor do mesmo projeto Supabase do AdoptNow:
-- https://supabase.com/dashboard/project/jhhuhafrnirbrrrsptpe/sql/new

create or replace function public.brazil_now_timestamp()
returns timestamp without time zone
language sql
stable
set search_path = public
as $$
  select timezone('America/Sao_Paulo', now())::timestamp without time zone;
$$;

create table if not exists public.potential_adopters (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  phone text not null,
  never_had_animals boolean not null default false,
  had_cats boolean not null default false,
  had_dogs boolean not null default false,
  animals_count integer not null default 0 check (animals_count >= 0),
  all_neutered boolean,
  still_alive boolean,
  death_reason text not null default '',
  home_safe boolean not null,
  has_window_screens boolean not null,
  home_type text not null check (home_type in ('casa', 'apartamento')),
  wants_kitten boolean not null default false,
  wants_adult boolean not null default false,
  sex_preference text not null check (sex_preference in ('femea', 'macho', 'indiferente')),
  sex_preference_reason text not null default '',
  agreed_to_process boolean not null default false,
  agreed_to_costs boolean not null default false,
  agreed_to_responsibility_term boolean not null default false,
  agreed_home_safe boolean not null default false,
  home_video_via_whatsapp boolean not null default false,
  home_video_url text not null default '',
  status text not null default 'novo'
    check (status in ('novo', 'contatado', 'convertido', 'descartado')),
  source text not null default 'form_web',
  notes text not null default '',
  converted_adopter_id uuid references public.adopters(id) on delete set null,
  created_at timestamp without time zone not null default public.brazil_now_timestamp(),
  updated_at timestamp without time zone not null default public.brazil_now_timestamp()
);

alter table public.potential_adopters add column if not exists never_had_animals boolean not null default false;
alter table public.potential_adopters add column if not exists had_cats boolean not null default false;
alter table public.potential_adopters add column if not exists had_dogs boolean not null default false;
alter table public.potential_adopters add column if not exists animals_count integer not null default 0;
alter table public.potential_adopters add column if not exists all_neutered boolean;
alter table public.potential_adopters add column if not exists still_alive boolean;
alter table public.potential_adopters add column if not exists death_reason text not null default '';
alter table public.potential_adopters add column if not exists home_safe boolean;
alter table public.potential_adopters add column if not exists has_window_screens boolean;
alter table public.potential_adopters add column if not exists home_type text;
alter table public.potential_adopters add column if not exists wants_kitten boolean not null default false;
alter table public.potential_adopters add column if not exists wants_adult boolean not null default false;
alter table public.potential_adopters add column if not exists sex_preference text;
alter table public.potential_adopters add column if not exists sex_preference_reason text not null default '';
alter table public.potential_adopters add column if not exists agreed_to_process boolean not null default false;
alter table public.potential_adopters add column if not exists agreed_to_costs boolean not null default false;
alter table public.potential_adopters add column if not exists agreed_to_responsibility_term boolean not null default false;
alter table public.potential_adopters add column if not exists agreed_home_safe boolean not null default false;
alter table public.potential_adopters add column if not exists home_video_via_whatsapp boolean not null default false;
alter table public.potential_adopters add column if not exists home_video_url text not null default '';

drop index if exists potential_adopters_phone_unique;
create index if not exists potential_adopters_phone_idx
  on public.potential_adopters (phone);
create index if not exists potential_adopters_created_at_idx
  on public.potential_adopters (created_at desc);
create index if not exists potential_adopters_status_idx
  on public.potential_adopters (status);

alter table public.potential_adopters enable row level security;

revoke all on public.potential_adopters from anon;
grant insert on public.potential_adopters to anon;
grant select, insert, update, delete on public.potential_adopters to authenticated;

drop policy if exists "potential_adopters_anon_insert" on public.potential_adopters;
create policy "potential_adopters_anon_insert"
  on public.potential_adopters for insert
  to anon
  with check (
    char_length(trim(full_name)) between 2 and 120
    and char_length(phone) between 10 and 11
    and phone ~ '^[0-9]+$'
    and status in ('novo', 'pendente')
    and source = 'form_web'
    and agreed_to_process = true
    and agreed_to_costs = true
    and agreed_to_responsibility_term = true
    and agreed_home_safe = true
    and (
      home_video_via_whatsapp = true
      or home_video_url like 'https://pub-69fe052b8ea841d295431051a32c1c9d.r2.dev/form-videos/%'
    )
    and home_type in ('casa', 'apartamento')
    and sex_preference in ('femea', 'macho', 'indiferente')
  );

drop policy if exists "potential_adopters_authenticated_all" on public.potential_adopters;
create policy "potential_adopters_authenticated_all"
  on public.potential_adopters for all
  to authenticated
  using (true)
  with check (true);
