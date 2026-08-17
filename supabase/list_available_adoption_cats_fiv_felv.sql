-- Inclui FIV e FELV na lista de gatinhos do formulário.
-- Rode no SQL Editor do mesmo projeto Supabase do AdoptNow:
-- https://supabase.com/dashboard/project/jhhuhafrnirbrrrsptpe/sql/new

drop function if exists public.list_available_adoption_cats();

create or replace function public.list_available_adoption_cats()
returns table (
  id uuid,
  name text,
  sex text,
  fur_color text,
  birth_date_approx date,
  photo_url text,
  quarantine_released_at date,
  fiv text,
  felv text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.name,
    c.sex,
    c.fur_color,
    c.birth_date_approx,
    nullif(c.photos[1], '') as photo_url,
    case
      when coalesce(c.quarantine_enabled, false)
        and c.quarantine_started_at is not null
        and (
          (current_timestamp at time zone 'America/Sao_Paulo')::date
          < ((c.quarantine_started_at at time zone 'America/Sao_Paulo')::date + 40)
        )
      then (c.quarantine_started_at at time zone 'America/Sao_Paulo')::date + 40
      else null
    end as quarantine_released_at,
    coalesce(nullif(c.medical->>'fiv', ''), 'nao_testado') as fiv,
    coalesce(nullif(c.medical->>'felv', ''), 'nao_testado') as felv
  from public.cats c
  where c.status = 'disponivel'
    and coalesce(c.hide_from_web, false) = false
  order by c.name asc;
$$;

revoke all on function public.list_available_adoption_cats() from public;
grant execute on function public.list_available_adoption_cats() to anon, authenticated;

notify pgrst, 'reload schema';
