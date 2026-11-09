-- Formulário web: status e pessoa conhecida passam a usar CPF
-- (em vez do celular). Auto-aprovação no merge só se o endereço for o mesmo.

create or replace function public.normalize_br_cpf(p_cpf text)
returns text
language sql
immutable
as $$
  select regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
$$;

revoke all on function public.normalize_br_cpf(text) from public;
grant execute on function public.normalize_br_cpf(text) to anon, authenticated, service_role;

create or replace function public.cpf_is_adopter(p_cpf text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select ad.id
  from public.adopters ad
  where public.normalize_br_cpf(ad.document) = public.normalize_br_cpf(p_cpf)
    and length(public.normalize_br_cpf(p_cpf)) = 11
  order by ad.created_at asc
  limit 1;
$$;

revoke all on function public.cpf_is_adopter(text) from public;
grant execute on function public.cpf_is_adopter(text) to anon, authenticated, service_role;

create or replace function public.form_address_matches(
  p_cep text,
  p_street text,
  p_neighborhood text,
  p_number text,
  p_city text,
  p_state text,
  p_other_cep text,
  p_other_street text,
  p_other_neighborhood text,
  p_other_number text,
  p_other_city text,
  p_other_state text
)
returns boolean
language sql
immutable
as $$
  select
    length(regexp_replace(coalesce(p_cep, ''), '\D', '', 'g')) = 8
    and length(regexp_replace(coalesce(p_other_cep, ''), '\D', '', 'g')) = 8
    and regexp_replace(coalesce(p_cep, ''), '\D', '', 'g')
      = regexp_replace(coalesce(p_other_cep, ''), '\D', '', 'g')
    and lower(trim(coalesce(p_street, ''))) = lower(trim(coalesce(p_other_street, '')))
    and lower(trim(coalesce(p_neighborhood, '')))
      = lower(trim(coalesce(p_other_neighborhood, '')))
    and lower(trim(coalesce(p_number, ''))) = lower(trim(coalesce(p_other_number, '')))
    and lower(trim(coalesce(p_city, ''))) = lower(trim(coalesce(p_other_city, '')))
    and upper(trim(coalesce(p_state, ''))) = upper(trim(coalesce(p_other_state, '')))
    and length(trim(coalesce(p_street, ''))) > 0
    and length(trim(coalesce(p_other_street, ''))) > 0;
$$;

revoke all on function public.form_address_matches(
  text, text, text, text, text, text, text, text, text, text, text, text
) from public;
grant execute on function public.form_address_matches(
  text, text, text, text, text, text, text, text, text, text, text, text
) to anon, authenticated, service_role;

create or replace function public.get_potential_adopter_cpf_status(
  p_cpf text,
  p_cat_id uuid default null,
  p_cat_name text default null
)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cpf text;
  v_adopter_id uuid;
  v_has_approved boolean;
  v_has_pending boolean;
  v_has_denied boolean;
  v_same_cat boolean;
begin
  v_cpf := public.normalize_br_cpf(p_cpf);
  if length(v_cpf) <> 11 then
    return '';
  end if;

  v_adopter_id := public.cpf_is_adopter(v_cpf);

  select
    coalesce(bool_or(pa.status in ('aprovado', 'convertido')), false),
    coalesce(bool_or(pa.status in ('novo', 'pendente')), false),
    coalesce(bool_or(pa.status in ('negado', 'descartado')), false),
    coalesce(bool_or(
      pa.status not in ('negado', 'descartado')
      and public.lead_has_interested_cat(pa.id, p_cat_id, p_cat_name)
    ), false)
  into v_has_approved, v_has_pending, v_has_denied, v_same_cat
  from public.potential_adopters pa
  where public.normalize_br_cpf(pa.document) = v_cpf;

  if v_has_denied and not v_has_approved and not v_has_pending then
    return 'negado';
  end if;

  if v_has_pending and not v_has_approved and v_adopter_id is null then
    return 'pendente';
  end if;

  if v_same_cat and (p_cat_id is not null or length(trim(coalesce(p_cat_name, ''))) > 0) then
    if v_has_approved or (v_has_pending and v_adopter_id is not null) then
      return 'aprovado';
    end if;
  end if;

  return '';
end;
$$;

revoke all on function public.get_potential_adopter_cpf_status(text, uuid, text) from public;
grant execute on function public.get_potential_adopter_cpf_status(text, uuid, text)
  to anon, authenticated, service_role;

create or replace function public.lookup_form_person_by_cpf(p_cpf text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_cpf text;
  v_adopter public.adopters%rowtype;
  v_lead public.potential_adopters%rowtype;
begin
  v_cpf := public.normalize_br_cpf(p_cpf);
  if length(v_cpf) <> 11 then
    return jsonb_build_object('known', false);
  end if;

  select *
  into v_adopter
  from public.adopters ad
  where public.normalize_br_cpf(ad.document) = v_cpf
  order by ad.created_at asc
  limit 1;

  if found then
    return jsonb_build_object(
      'known', true,
      'kind', 'adopter',
      'adopterId', v_adopter.id,
      'fullName', coalesce(v_adopter.full_name, ''),
      'phone', public.normalize_br_phone(v_adopter.phone),
      'document', v_cpf,
      'documentPhotoUrl', coalesce(v_adopter.document_photo_url, ''),
      'documentCheckStatus', coalesce(v_adopter.document_check_status, ''),
      'address', jsonb_build_object(
        'cep', coalesce(v_adopter.address_cep, ''),
        'street', coalesce(v_adopter.address_street, ''),
        'neighborhood', coalesce(v_adopter.address_neighborhood, ''),
        'number', coalesce(v_adopter.address_number, ''),
        'city', coalesce(v_adopter.address_city, ''),
        'state', coalesce(v_adopter.address_state, '')
      )
    );
  end if;

  select *
  into v_lead
  from public.potential_adopters pa
  where public.normalize_br_cpf(pa.document) = v_cpf
    and pa.status in ('aprovado', 'convertido')
  order by pa.updated_at desc nulls last, pa.created_at desc
  limit 1;

  if not found then
    return jsonb_build_object('known', false);
  end if;

  return jsonb_build_object(
    'known', true,
    'kind', 'approved',
    'adopterId', v_lead.converted_adopter_id,
    'fullName', coalesce(v_lead.full_name, ''),
    'phone', public.normalize_br_phone(v_lead.phone),
    'document', v_cpf,
    'documentPhotoUrl', coalesce(v_lead.document_photo_url, ''),
    'documentCheckStatus', coalesce(v_lead.document_check_status, ''),
    'address', jsonb_build_object(
      'cep', coalesce(v_lead.address_cep, ''),
      'street', coalesce(v_lead.address_street, ''),
      'neighborhood', coalesce(v_lead.address_neighborhood, ''),
      'number', coalesce(v_lead.address_number, ''),
      'city', coalesce(v_lead.address_city, ''),
      'state', coalesce(v_lead.address_state, '')
    )
  );
end;
$$;

revoke all on function public.lookup_form_person_by_cpf(text) from public;
grant execute on function public.lookup_form_person_by_cpf(text)
  to anon, authenticated, service_role;

create or replace function public.merge_potential_adopter_repeat_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text;
  v_adopter_id uuid;
  v_has_approved boolean := false;
  v_has_pending boolean := false;
  v_has_denied boolean := false;
  v_same_cat boolean := false;
  v_address_matches boolean := false;
  v_known_cep text := '';
  v_known_street text := '';
  v_known_neighborhood text := '';
  v_known_number text := '';
  v_known_city text := '';
  v_known_state text := '';
  v_other_id uuid;
  v_cat_name text;
  v_auto_approve boolean := false;
begin
  v_cpf := public.normalize_br_cpf(NEW.document);
  if length(v_cpf) <> 11 then
    return NEW;
  end if;

  v_adopter_id := public.cpf_is_adopter(v_cpf);
  v_cat_name := trim(coalesce(NEW.interested_cat_name, ''));

  select
    coalesce(bool_or(pa.status in ('aprovado', 'convertido')), false),
    coalesce(bool_or(pa.status in ('novo', 'pendente')), false),
    coalesce(bool_or(pa.status in ('negado', 'descartado')), false)
  into v_has_approved, v_has_pending, v_has_denied
  from public.potential_adopters pa
  where pa.id <> NEW.id
    and public.normalize_br_cpf(pa.document) = v_cpf;

  if v_has_denied and not v_has_approved and not v_has_pending then
    raise exception 'Não é possível se cadastrar como interessado.';
  end if;

  if v_has_pending and not v_has_approved and v_adopter_id is null then
    raise exception 'Seu cadastro está em análise. Aguarde, em breve entraremos em contato.';
  end if;

  select coalesce(bool_or(
    public.lead_has_interested_cat(pa.id, NEW.interested_cat_id, v_cat_name)
  ), false)
  into v_same_cat
  from public.potential_adopters pa
  where pa.id <> NEW.id
    and public.normalize_br_cpf(pa.document) = v_cpf
    and pa.status not in ('negado', 'descartado');

  if v_same_cat and (
    NEW.interested_cat_id is not null or length(v_cat_name) > 0
  ) then
    raise exception 'Você já está na lista para este gato. Aguarde, em breve entraremos em contato.';
  end if;

  if v_adopter_id is not null then
    select
      coalesce(ad.address_cep, ''),
      coalesce(ad.address_street, ''),
      coalesce(ad.address_neighborhood, ''),
      coalesce(ad.address_number, ''),
      coalesce(ad.address_city, ''),
      coalesce(ad.address_state, '')
    into
      v_known_cep,
      v_known_street,
      v_known_neighborhood,
      v_known_number,
      v_known_city,
      v_known_state
    from public.adopters ad
    where ad.id = v_adopter_id;
  elsif v_has_approved then
    select
      coalesce(pa.address_cep, ''),
      coalesce(pa.address_street, ''),
      coalesce(pa.address_neighborhood, ''),
      coalesce(pa.address_number, ''),
      coalesce(pa.address_city, ''),
      coalesce(pa.address_state, '')
    into
      v_known_cep,
      v_known_street,
      v_known_neighborhood,
      v_known_number,
      v_known_city,
      v_known_state
    from public.potential_adopters pa
    where pa.id <> NEW.id
      and public.normalize_br_cpf(pa.document) = v_cpf
      and pa.status in ('aprovado', 'convertido')
    order by pa.updated_at desc nulls last, pa.created_at desc
    limit 1;
  end if;

  v_address_matches := public.form_address_matches(
    NEW.address_cep,
    NEW.address_street,
    NEW.address_neighborhood,
    NEW.address_number,
    NEW.address_city,
    NEW.address_state,
    v_known_cep,
    v_known_street,
    v_known_neighborhood,
    v_known_number,
    v_known_city,
    v_known_state
  );

  v_auto_approve :=
    (v_adopter_id is not null or v_has_approved)
    and v_address_matches;

  if not v_has_approved and not v_has_pending then
    if v_auto_approve and NEW.status is distinct from 'aprovado' then
      update public.potential_adopters
      set
        status = 'aprovado',
        is_returning_adopter = v_adopter_id is not null
          and exists (
            select 1 from public.adoptions a where a.adopter_id = v_adopter_id
          ),
        converted_adopter_id = coalesce(converted_adopter_id, v_adopter_id),
        reviewed_at = coalesce(
          reviewed_at,
          (timezone('America/Sao_Paulo', now()))::date
        ),
        updated_at = public.brazil_now_timestamp()
      where id = NEW.id;
    end if;
    return NEW;
  end if;

  insert into public.potential_adopter_cats (potential_adopter_id, cat_id, cat_name)
  select NEW.id, c.cat_id, c.cat_name
  from public.potential_adopter_cats c
  join public.potential_adopters pa on pa.id = c.potential_adopter_id
  left join public.cats ct on ct.id = c.cat_id
  where pa.id <> NEW.id
    and public.normalize_br_cpf(pa.document) = v_cpf
    and pa.status not in ('negado', 'descartado')
    and (
      c.cat_id is null
      or ct.status is null
      or ct.status not in ('reservado', 'adotado')
    )
    and not exists (
      select 1
      from public.potential_adopter_cats existing
      where existing.potential_adopter_id = NEW.id
        and (
          (c.cat_id is not null and existing.cat_id = c.cat_id)
          or (
            c.cat_id is null
            and existing.cat_id is null
            and lower(trim(existing.cat_name)) = lower(trim(c.cat_name))
          )
        )
    );

  update public.potential_adopters
  set
    status = case
      when v_auto_approve then 'aprovado'
      else status
    end,
    is_returning_adopter = v_adopter_id is not null
      and exists (
        select 1 from public.adoptions a where a.adopter_id = v_adopter_id
      ),
    converted_adopter_id = coalesce(converted_adopter_id, v_adopter_id),
    reviewed_at = case
      when v_auto_approve then coalesce(
        reviewed_at,
        (timezone('America/Sao_Paulo', now()))::date
      )
      else reviewed_at
    end,
    updated_at = public.brazil_now_timestamp()
  where id = NEW.id;

  for v_other_id in
    select pa.id
    from public.potential_adopters pa
    where pa.id <> NEW.id
      and public.normalize_br_cpf(pa.document) = v_cpf
      and pa.status not in ('negado', 'descartado')
  loop
    delete from public.potential_adopters where id = v_other_id;
  end loop;

  return NEW;
end;
$$;

drop trigger if exists zz_merge_potential_adopter_repeat_interest_trg
  on public.potential_adopters;

create trigger zz_merge_potential_adopter_repeat_interest_trg
  after insert on public.potential_adopters
  for each row
  execute function public.merge_potential_adopter_repeat_interest();

notify pgrst, 'reload schema';
