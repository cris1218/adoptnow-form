"use client";

import { useActionState, useEffect, useState } from "react";

import {
  loadAdopterCompletion,
  submitAdopterCompletion,
  verifyDocumentPhoto,
  type CompletionFormState,
  type CompletionPrefill,
} from "@/app/completar-cadastro/actions";
import { LgpdNotice } from "@/components/LgpdNotice";
import { DocumentPhotoField } from "@/components/DocumentPhotoField";
import {
  FieldError,
  fieldBorderClass,
  useValidityMessage,
} from "@/components/FormFields";
import { IdentityAddressFields } from "@/components/IdentityAddressFields";
import { PawMark } from "@/components/PawMark";
import { fullNameError, isValidPhone, maskPhone } from "@/lib/masks";

const initialState: CompletionFormState = null;

const inputBase =
  "h-14 w-full rounded-2xl border bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:ring-2 disabled:bg-stone-100 disabled:text-stone-500";

type FieldName = "fullName" | "phone";

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
  const [prefill, setPrefill] = useState<CompletionPrefill | null>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
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
  };

  const fullNameRef = useValidityMessage<HTMLInputElement>(errors.fullName);
  const phoneRef = useValidityMessage<HTMLInputElement>(errors.phone);

  function visibleError(field: FieldName) {
    return touched[field] ? errors[field] : "";
  }

  function fieldProps(field: FieldName) {
    const message = visibleError(field);
    const touch = () =>
      setTouched((current) =>
        current[field] ? current : { ...current, [field]: true }
      );
    return {
      "aria-invalid": Boolean(message) || undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
      onBlur: touch,
      onInvalid: touch,
      className: `${inputBase} ${fieldBorderClass(Boolean(message))}`,
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

        setPrefill(result.data);
        setFullName(result.data.fullName);
        setPhone(maskPhone(result.data.phone));
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

      <IdentityAddressFields initial={prefill ?? undefined} />

      <DocumentPhotoField
        required
        onBusyChange={setPhotoBusy}
        checkDocument={
          preview
            ? undefined
            : (url) => verifyDocumentPhoto(token, phoneCipher, url)
        }
      />

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
                ? "Processando foto..."
                : "Enviar dados"}
        </button>
      </div>
    </form>
  );
}
