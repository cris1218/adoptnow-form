# Recanto do Ron Ron — formulário de adoção

Site Next.js com um formulário mobile-first para possíveis adotantes. Ao salvar, o contato vai para a tabela `potential_adopters` no mesmo Supabase do app AdoptNow.

## Stack

- Next.js 16 (App Router)
- Tailwind CSS
- Supabase (Postgres + RLS)

Hospedagem gratuita: [Vercel](https://vercel.com).

## Setup

1. No [SQL Editor do Supabase](https://supabase.com/dashboard/project/jhhuhafrnirbrrrsptpe/sql/new), rode `supabase/potential_adopters.sql`.
2. Copie `.env.example` para `.env.local` e preencha:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY` (a mesma publishable/anon key do app)
3. Instale e rode:

```bash
yarn
yarn dev
```

Abra [http://localhost:3000](http://localhost:3000).

## O que o formulário coleta

- Nome e WhatsApp
- Questionário de adoção (animais anteriores, lar seguro, telas, casa/apto, filhote/adulto, preferência de sexo)
- Concordância com o processo (telas, vídeo, termo e custos de castração/vermífugo/antipulgas)
- Concordância com as condições financeiras (ração, areia e veterinário)

As respostas vão para a tabela `potential_adopters`.

## Publicar (GitHub + Vercel)

1. Suba o código para o GitHub.
2. Importe o repositório em [vercel.com/new](https://vercel.com/new).
3. Em Environment Variables, cadastre:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
4. Deploy. O link gerado (ex.: `https://recantoronron.vercel.app`) é o que vai para o adotante.
