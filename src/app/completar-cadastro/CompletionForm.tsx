"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import {
  loadAdopterCompletion,
  submitAdopterCompletion,
  type CompletionFormState,
} from "@/app/completar-cadastro/actions";
import { LgpdNotice } from "@/components/LgpdNotice";
import { DocumentPhotoField } from "@/components/DocumentPhotoField";
import {
  FieldError,
  fieldBorderClass,
  useValidityMessage,
} from "@/components/FormFields";
import { PawMark } from "@/components/PawMark";
import { fetchAddressByCep } from "@/lib/cep";
import {
  cepError,
  cpfError,
  fullNameError,
  houseNumberError,
  isValidPhone,
  maskCep,
  maskCpf,
  maskPhone,
  onlyDigits,
} from "@/lib/masks";

const initialState: CompletionFormState = null;

const inputBase =
  "h-14 w-full rounded-2xl border bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:ring-2 disabled:bg-stone-100 disabled:text-stone-500";

function inputClass(invalid = false) {
  return `${inputBase} ${fieldBorderClass(invalid)}`;
}

function textError(value: string, emptyMessage: string, minLength = 2) {
  const trimmed = value.trim();
  if (!trimmed) return emptyMessage;
  if (trimmed.length < minLength) {
    return `Informe pelo menos ${minLength} caracteres.`;
  }
  return "";
}

function ufError(value: string) {
  if (!value.trim()) return "Informe a UF.";
  if (!/^[A-Z]{2}$/.test(value)) return "Use a sigla do estado (ex.: RS).";
  return "";
}

type FieldName =
  | "fullName"
  | "phone"
  | "document"
  | "cep"
  | "street"
  | "neighborhood"
  | "number"
  | "city"
  | "state";

export function CompletionForm({
  token,
  phoneCipher,
  preview = false,
}: {
  token: string;
  phoneCipher: string;
  preview?: boolean;
}) {
  const [state, action, pending] = useActionState(
    submitAdopterCompletion,
    initialState
  );
  const [loading, setLoading] = useState(!preview);
  const [loadError, setLoadError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [document, setDocument] = useState("");
  const [cep, setCep] = useState("");
  const [street, setStreet] = useState("");
  const [neighborhood, setNeighborhood] = useState("");
  const [number, setNumber] = useState("");
  const [city, setCity] = useState("");
  const [uf, setUf] = useState("");
  const [cepHint, setCepHint] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const cepLookupSeq = useRef(0);
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {}
  );

  const errors: Record<FieldName, string> = {
    fullName: preview ? fullNameError(fullName) : "",
    phone: preview
      ? phone
        ? isValidPhone(phone)
          ? ""
          : "Informe um telefone válido com DDD."
        : "Informe seu telefone."
      : "",
    document: cpfError(document),
    cep: cepError(cep),
    street: textError(street, "Informe a rua."),
    neighborhood: textError(neighborhood, "Informe o bairro."),
    number: houseNumberError(number),
    city: textError(city, "Informe a cidade."),
    state: ufError(uf),
  };

  const fullNameRef = useValidityMessage<HTMLInputElement>(errors.fullName);
  const phoneRef = useValidityMessage<HTMLInputElement>(errors.phone);
  const documentRef = useValidityMessage<HTMLInputElement>(errors.document);
  const cepRef = useValidityMessage<HTMLInputElement>(errors.cep);
  const streetRef = useValidityMessage<HTMLInputElement>(errors.street);
  const neighborhoodRef = useValidityMessage<HTMLInputElement>(
    errors.neighborhood
  );
  const numberInputRef = useValidityMessage<HTMLInputElement>(errors.number);
  const cityRef = useValidityMessage<HTMLInputElement>(errors.city);
  const stateRef = useValidityMessage<HTMLInputElement>(errors.state);

  function touch(field: FieldName) {
    setTouched((current) =>
      current[field] ? current : { ...current, [field]: true }
    );
  }

  function visibleError(field: FieldName) {
    return touched[field] ? errors[field] : "";
  }

  function fieldProps(field: FieldName) {
    const message = visibleError(field);
    return {
      "aria-invalid": Boolean(message) || undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
      onBlur: () => touch(field),
      onInvalid: () => touch(field),
      className: inputClass(Boolean(message)),
    };
  }

  useEffect(() => {
    if (preview) return;

    let cancelled = false;

    void loadAdopterCompletion(token, phoneCipher)
      .then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setLoadError(result.message);
          setLoading(false);
          return;
        }

        setFullName(result.data.fullName);
        setPhone(maskPhone(result.data.phone));
        setDocument(maskCpf(result.data.document));
        setCep(maskCep(result.data.cep));
        setStreet(result.data.street);
        setNeighborhood(result.data.neighborhood);
        setNumber(result.data.number);
        setCity(result.data.city);
        setUf(result.data.state.toUpperCase());
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setLoadError("Não foi possível abrir este link agora. Tente novamente.");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [preview, token, phoneCipher]);

  async function handleCepChange(value: string) {
    const masked = maskCep(value);
    setCep(masked);
    const digits = onlyDigits(masked);
    if (digits.length !== 8) {
      cepLookupSeq.current += 1;
      setCepHint("");
      return;
    }

    const seq = ++cepLookupSeq.current;
    setCepHint("Buscando endereço...");
    try {
      const address = await fetchAddressByCep(digits);
      if (seq !== cepLookupSeq.current) return;
      setStreet(address.street);
      setNeighborhood(address.neighborhood);
      setCity(address.city);
      setUf(address.state);
      setCepHint("");
      numberInputRef.current?.focus();
    } catch {
      if (seq !== cepLookupSeq.current) return;
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
      action={preview ? undefined : action}
      className="flex flex-col gap-5"
      onSubmit={
        preview
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      onInvalid={(event) => {
        const field = event.target as HTMLElement;
        field
          .closest("section, label, div")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="phoneCipher" value={phoneCipher} />

      {preview ? (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900">
          Visualização de teste. O envio está desativado.
        </p>
      ) : null}

      <div>
        <h2 className="text-xl font-extrabold text-stone-900">
          Completar cadastro
        </h2>
        <p className="mt-1 text-sm leading-relaxed text-stone-600">
          Preencha o CPF e o endereço para concluirmos seu cadastro de adoção.
        </p>
      </div>

      <div>
        <label htmlFor="fullName" className="mb-2 block text-sm font-semibold text-stone-700">
          Nome completo
        </label>
        <input
          ref={fullNameRef}
          id="fullName"
          name="fullName"
          value={fullName}
          disabled={!preview}
          readOnly={!preview}
          required={preview}
          maxLength={120}
          autoComplete="name"
          autoCapitalize="words"
          placeholder={preview ? "Nome e sobrenome" : undefined}
          onChange={
            preview
              ? (event) => setFullName(event.target.value)
              : undefined
          }
          {...fieldProps("fullName")}
        />
        <FieldError id="fullName-error" message={visibleError("fullName")} />
      </div>

      <div>
        <label htmlFor="phone" className="mb-2 block text-sm font-semibold text-stone-700">
          Telefone
        </label>
        <input
          ref={phoneRef}
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          disabled={!preview}
          readOnly={!preview}
          required={preview}
          autoComplete="tel-national"
          placeholder={preview ? "(51) 99999-0000" : undefined}
          onChange={
            preview
              ? (event) => setPhone(maskPhone(event.target.value))
              : undefined
          }
          {...fieldProps("phone")}
        />
        <FieldError id="phone-error" message={visibleError("phone")} />
      </div>

      <div>
        <label htmlFor="document" className="mb-2 block text-sm font-semibold text-stone-700">
          CPF
        </label>
        <input
          ref={documentRef}
          id="document"
          name="document"
          inputMode="numeric"
          required
          autoComplete="off"
          placeholder="000.000.000-00"
          value={document}
          onChange={(event) => setDocument(maskCpf(event.target.value))}
          {...fieldProps("document")}
        />
        <FieldError id="document-error" message={visibleError("document")} />
      </div>

      <div>
        <label htmlFor="cep" className="mb-2 block text-sm font-semibold text-stone-700">
          CEP
        </label>
        <input
          ref={cepRef}
          id="cep"
          name="cep"
          inputMode="numeric"
          required
          autoComplete="postal-code"
          placeholder="00000-000"
          value={cep}
          onChange={(event) => void handleCepChange(event.target.value)}
          {...fieldProps("cep")}
        />
        <FieldError id="cep-error" message={visibleError("cep")} />
        {cepHint ? (
          <p className="mt-2 text-sm text-stone-500">{cepHint}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="street" className="mb-2 block text-sm font-semibold text-stone-700">
          Rua
        </label>
        <input
          ref={streetRef}
          id="street"
          name="street"
          required
          maxLength={160}
          autoComplete="address-line1"
          value={street}
          onChange={(event) => setStreet(event.target.value)}
          {...fieldProps("street")}
        />
        <FieldError id="street-error" message={visibleError("street")} />
      </div>

      <div>
        <label htmlFor="neighborhood" className="mb-2 block text-sm font-semibold text-stone-700">
          Bairro
        </label>
        <input
          ref={neighborhoodRef}
          id="neighborhood"
          name="neighborhood"
          required
          maxLength={120}
          value={neighborhood}
          onChange={(event) => setNeighborhood(event.target.value)}
          {...fieldProps("neighborhood")}
        />
        <FieldError
          id="neighborhood-error"
          message={visibleError("neighborhood")}
        />
      </div>

      <div>
        <label htmlFor="number" className="mb-2 block text-sm font-semibold text-stone-700">
          Número da casa
        </label>
        <input
          ref={numberInputRef}
          id="number"
          name="number"
          inputMode="numeric"
          required
          maxLength={7}
          placeholder="123"
          value={number}
          onChange={(event) =>
            setNumber(event.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 7))
          }
          {...fieldProps("number")}
        />
        <FieldError id="number-error" message={visibleError("number")} />
      </div>

      <div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="city" className="mb-2 block text-sm font-semibold text-stone-700">
              Cidade
            </label>
            <input
              ref={cityRef}
              id="city"
              name="city"
              required
              maxLength={120}
              autoComplete="address-level2"
              value={city}
              onChange={(event) => setCity(event.target.value)}
              {...fieldProps("city")}
            />
          </div>
          <div className="w-24">
            <label htmlFor="state" className="mb-2 block text-sm font-semibold text-stone-700">
              UF
            </label>
            <input
              ref={stateRef}
              id="state"
              name="state"
              required
              maxLength={2}
              autoCapitalize="characters"
              autoComplete="address-level1"
              value={uf}
              onChange={(event) =>
                setUf(
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 2)
                )
              }
              {...fieldProps("state")}
            />
          </div>
        </div>
        <FieldError id="city-error" message={visibleError("city")} />
        <FieldError id="state-error" message={visibleError("state")} />
      </div>

      <DocumentPhotoField onBusyChange={setPhotoBusy} />

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
          disabled={preview || pending || photoBusy}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition active:scale-[0.99] enabled:hover:bg-brand-950 disabled:opacity-60"
        >
          {preview
            ? "Envio desativado"
            : pending
              ? "Enviando..."
              : photoBusy
                ? "Enviando foto..."
                : "Enviar dados"}
        </button>
      </div>
    </form>
  );
}
