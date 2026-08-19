-- Abrir o link não deve depender do cleanup (revoke no anon fazia o GET
-- estourar). Recarrega o schema do PostgREST e garante execute no anon.

drop function if exists public.get_adopter_completion_form(text);

create or replace function public.adopter_completion_phone_matches(
  p_token text,
  p_cipher text,
  p_phone text
)
returns boolean
language sql
stable
set search_path = public, extensions
as $$
  select coalesce(
    public.adopter_completion_decrypt_phone(p_token, p_cipher)
      = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'),
    false
  );
$$;

create or replace function public.get_adopter_completion_form(
  p_token text,
  p_phone_cipher text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token public.adopter_completion_tokens%rowtype;
  v_adopter public.adopters%rowtype;
begin
  select *
  into v_token
  from public.adopter_completion_tokens
  where token = trim(p_token)
    and used_at is null
    and expires_at >= public.brazil_now_timestamp()
  limit 1;

  if v_token.id is null
    or not public.adopter_completion_phone_matches(
      v_token.token,
      p_phone_cipher,
      (select phone from public.adopters where id = v_token.adopter_id)
    )
  then
    return jsonb_build_object(
      'ok', false,
      'error', 'Este link é inválido, expirou ou já foi usado.'
    );
  end if;

  select * into v_adopter from public.adopters where id = v_token.adopter_id;
  if v_adopter.id is null then
    return jsonb_build_object('ok', false, 'error', 'Adotante não encontrado.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'full_name', coalesce(v_adopter.full_name, ''),
    'phone', coalesce(v_adopter.phone, ''),
    'document', coalesce(v_adopter.document, ''),
    'cep', coalesce(v_adopter.address_cep, ''),
    'street', coalesce(v_adopter.address_street, ''),
    'neighborhood', coalesce(v_adopter.address_neighborhood, ''),
    'number', coalesce(v_adopter.address_number, ''),
    'city', coalesce(v_adopter.address_city, ''),
    'state', coalesce(v_adopter.address_state, '')
  );
exception
  when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'Não foi possível abrir este link agora. Tente novamente.'
    );
end;
$$;

revoke all on function public.get_adopter_completion_form(text, text) from public;
grant execute on function public.get_adopter_completion_form(text, text)
  to anon, authenticated, service_role;

notify pgrst, 'reload schema';
