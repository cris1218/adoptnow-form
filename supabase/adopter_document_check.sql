-- Resultado da verificação automática (Gemini) da foto do documento enviada
-- no completar cadastro. Status: verificado | reprovado | nao_verificado.

alter table public.adopters
  add column if not exists document_check_status text,
  add column if not exists document_check_reason text,
  add column if not exists document_checked_at timestamptz;

create or replace function public.set_adopter_document_check(
  p_token text,
  p_phone_cipher text,
  p_status text,
  p_reason text
)
returns boolean
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_token public.adopter_completion_tokens%rowtype;
begin
  if p_status not in ('verificado', 'reprovado', 'nao_verificado') then
    return false;
  end if;

  select *
  into v_token
  from public.adopter_completion_tokens
  where token = trim(p_token)
  limit 1;

  if v_token.id is null
    or not public.adopter_completion_phone_matches(
      v_token.token,
      p_phone_cipher,
      (select phone from public.adopters where id = v_token.adopter_id)
    )
  then
    return false;
  end if;

  update public.adopters
  set document_check_status = p_status,
      document_check_reason = left(coalesce(p_reason, ''), 300),
      document_checked_at = now()
  where id = v_token.adopter_id;

  return found;
end;
$$;

revoke all on function public.set_adopter_document_check(text, text, text, text) from public;
revoke all on function public.set_adopter_document_check(text, text, text, text) from anon, authenticated;
grant execute on function public.set_adopter_document_check(text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
