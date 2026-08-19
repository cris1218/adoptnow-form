"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  loadAdopterCompletion,
  submitAdopterCompletion,
  type CompletionFormState,
} from "@/app/completar-cadastro/actions";
import { LgpdNotice } from "@/components/LgpdNotice";
import { PawMark } from "@/components/PawMark";
import { fetchAddressByCep } from "@/lib/cep";
import { maskCep, maskCpf, onlyDigits } from "@/lib/masks";

const initialState: CompletionFormState = null;

const inputClass =
  "h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2 disabled:bg-stone-100 disabled:text-stone-500";

export function CompletionForm({
  token,
  phoneCipher,
}: {
  token: string;
  phoneCipher: string;
}) {
  const [state, action, pending] = useActionState(
    submitAdopterCompletion,
    initialState
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [document, setDocument] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepHint, setCepHint] = useState("");
  const numberInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;

    void loadAdopterCompletion(token, phoneCipher).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.message);
        setLoading(false);
        return;
      }

      setDocument(maskCpf(result.data.document));
      setCep(maskCep(result.data.cep));
      setStreet(result.data.street);
      setNeighborhood(result.data.neighborhood);
      setNumber(result.data.number);
      setCity(result.data.city);
      setUf(result.data.state.toUpperCase());
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [token, phoneCipher]);

  async function handleCepChange(value: string) {
    const masked = maskCep(value);
    setCep(masked);
    const digits = onlyDigits(masked);
    if (digits.length !== 8) {
      setCepHint("");
      return;
    }

    setCepHint("Buscando endereço...");
    try {
      const address = await fetchAddressByCep(digits);
      setStreet(address.street);
      setNeighborhood(address.neighborhood);
      setCity(address.city);
      setUf(address.state);
      setCepHint("");
      numberInputRef.current?.focus();
    } catch {
      setCepHint("CEP não encontrado. Preencha o endereço manualmente.");
    }
  }

  if (state?.ok) {
    return (
      <section className="flex flex-col items-center px-2 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path
              d="M5 12.5 9.5 17 19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-900">
          Cadastro atualizado
        </h2>
        <p className="mt-2 max-w-sm text-base leading-relaxed text-stone-600">
          {state.message}
        </p>
        <PawMark className="mt-8 h-10 w-10 text-brand-light/70" />
      </section>
    );
  }

  if (loading) {
    return (
      <p className="py-10 text-center text-base text-stone-600">
        Carregando seus dados...
      </p>
    );
  }

  if (loadError) {
    return (
      <p
        role="alert"
        className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium leading-relaxed text-rose-700"
      >
        {loadError}
      </p>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      onInvalid={(event) => {
        const field = event.target as HTMLElement;
        field
          .closest("section, label, div")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="phoneCipher" value={phoneCipher} />

      <div>
        <h2 className="text-xl font-extrabold text-stone-900">
          Completar cadastro
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Preencha o CPF e o endereço para concluirmos seu cadastro de adoção.
        </p>
      </div>

      <div>
        <label htmlFor="document" className="mb-2 block text-sm font-semibold text-stone-700">
          CPF
        </label>
        <input
          id="document"
          name="document"
          inputMode="numeric"
          required
          autoComplete="off"
          placeholder="000.000.000-00"
          value={document}
          onChange={(event) => setDocument(maskCpf(event.target.value))}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="cep" className="mb-2 block text-sm font-semibold text-stone-700">
          CEP
        </label>
        <input
          id="cep"
          name="cep"
          inputMode="numeric"
          required
          autoComplete="postal-code"
          placeholder="00000-000"
          value={cep}
          onChange={(event) => void handleCepChange(event.target.value)}
          className={inputClass}
        />
        {cepHint ? (
          <p className="mt-2 text-sm text-stone-500">{cepHint}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="street" className="mb-2 block text-sm font-semibold text-stone-700">
          Rua
        </label>
        <input
          id="street"
          name="street"
          required
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="neighborhood" className="mb-2 block text-sm font-semibold text-stone-700">
          Bairro
        </label>
        <input
          id="neighborhood"
          name="neighborhood"
          required
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="number" className="mb-2 block text-sm font-semibold text-stone-700">
          Número
        </label>
        <input
          ref={numberInputRef}
          id="number"
          name="number"
          inputMode="numeric"
          required
          value={number}
          onChange={(event) => setNumber(event.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex gap-3">
        <div className="flex-1">
          <label htmlFor="city" className="mb-2 block text-sm font-semibold text-stone-700">
            Cidade
          </label>
          <input
            id="city"
            name="city"
            required
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className={inputClass}
          />
        </div>
        <div className="w-24">
          <label htmlFor="state" className="mb-2 block text-sm font-semibold text-stone-700">
            UF
          </label>
          <input
            id="state"
            name="state"
            required
            maxLength={2}
            autoCapitalize="characters"
            value={uf}
            onChange={(event) => setUf(event.target.value.toUpperCase().slice(0, 2))}
            className={inputClass}
          />
        </div>
      </div>

      <LgpdNotice />

      <label className="flex gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
        <input
          type="checkbox"
          name="agreedToLgpd"
          value="true"
          required
          className="mt-1 h-5 w-5 shrink-0 accent-[#148B87]"
        />
        <span className="text-sm leading-relaxed text-stone-700">
          Autorizo o Recanto do Ron Ron a armazenar e usar meus dados pessoais
          somente para o processo de adoção, conforme a LGPD.
        </span>
      </label>

      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-6 mt-1 border-t border-stone-200 bg-white/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm compact:-mx-3 compact:px-3">
        <button
          type="submit"
          disabled={pending}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition active:scale-[0.99] enabled:hover:bg-brand-950 disabled:opacity-60"
        >
          {pending ? "Enviando..." : "Enviar dados"}
        </button>
      </div>
    </form>
  );
}
