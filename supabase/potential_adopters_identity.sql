-- CPF, endereço e foto do documento no questionário de possíveis adotantes,
-- com o resultado da verificação automática (Gemini) da foto.
-- Rode ANTES de publicar a versão do formulário que envia esses campos.

alter table public.potential_adopters add column if not exists document text not null default '';
alter table public.potential_adopters add column if not exists address_cep text not null default '';
alter table public.potential_adopters add column if not exists address_street text not null default '';
alter table public.potential_adopters add column if not exists address_neighborhood text not null default '';
alter table public.potential_adopters add column if not exists address_number text not null default '';
alter table public.potential_adopters add column if not exists address_city text not null default '';
alter table public.potential_adopters add column if not exists address_state text not null default '';
alter table public.potential_adopters add column if not exists document_photo_url text not null default '';
alter table public.potential_adopters add column if not exists document_check_status text not null default ''
  check (document_check_status in ('', 'verificado', 'reprovado', 'nao_verificado'));
alter table public.potential_adopters add column if not exists document_check_reason text not null default '';

notify pgrst, 'reload schema';
