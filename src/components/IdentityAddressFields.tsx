"use client";

import { useRef, useState, type RefObject } from "react";

import {
  FieldError,
  fieldBorderClass,
  useValidityMessage,
} from "@/components/FormFields";
import { fetchAddressByCep } from "@/lib/cep";
import {
  identityAddressErrors,
  type IdentityAddress,
} from "@/lib/identityAddress";
import { maskCep, maskCpf, onlyDigits } from "@/lib/masks";

type FieldName = keyof IdentityAddress;

const inputBase =
  "h-14 w-full rounded-2xl border bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:ring-2";

const labelClass = "mb-2 block text-sm font-semibold text-stone-700";

const EMPTY: IdentityAddress = {
  document: "",
  cep: "",
  street: "",
  neighborhood: "",
  number: "",
  city: "",
  state: "",
};

export function IdentityAddressFields({
  initial,
}: {
  initial?: Partial<IdentityAddress>;
}) {
  const [values, setValues] = useState<IdentityAddress>(() => ({
    ...EMPTY,
    ...initial,
    document: maskCpf(initial?.document ?? ""),
    cep: maskCep(initial?.cep ?? ""),
    state: (initial?.state ?? "").toUpperCase(),
  }));
  const [touched, setTouched] = useState<Partial<Record<FieldName, boolean>>>(
    {}
  );
  const [cepHint, setCepHint] = useState("");
  const cepLookupSeq = useRef(0);

  const errors = identityAddressErrors(values);
  const refs: Record<FieldName, RefObject<HTMLInputElement | null>> = {
    document: useValidityMessage<HTMLInputElement>(errors.document),
    cep: useValidityMessage<HTMLInputElement>(errors.cep),
    street: useValidityMessage<HTMLInputElement>(errors.street),
    neighborhood: useValidityMessage<HTMLInputElement>(errors.neighborhood),
    number: useValidityMessage<HTMLInputElement>(errors.number),
    city: useValidityMessage<HTMLInputElement>(errors.city),
    state: useValidityMessage<HTMLInputElement>(errors.state),
  };

  function setField(field: FieldName, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

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
      ref: refs[field],
      id: field,
      name: field,
      required: true,
      value: values[field],
      "aria-invalid": Boolean(message) || undefined,
      "aria-describedby": message ? `${field}-error` : undefined,
      onBlur: touch,
      onInvalid: touch,
      className: `${inputBase} ${fieldBorderClass(Boolean(message))}`,
    };
  }

  async function handleCepChange(value: string) {
    const masked = maskCep(value);
    setField("cep", masked);
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
      setValues((current) => ({
        ...current,
        street: address.street,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
      }));
      setCepHint("");
      refs.number.current?.focus();
    } catch {
      if (seq !== cepLookupSeq.current) return;
      setCepHint("CEP não encontrado. Preencha o endereço manualmente.");
    }
  }

  return (
    <>
      <div>
        <label htmlFor="document" className={labelClass}>
          CPF
        </label>
        <input
          {...fieldProps("document")}
          inputMode="numeric"
          autoComplete="off"
          placeholder="000.000.000-00"
          onChange={(event) => setField("document", maskCpf(event.target.value))}
        />
        <FieldError id="document-error" message={visibleError("document")} />
      </div>

      <div>
        <label htmlFor="cep" className={labelClass}>
          CEP
        </label>
        <input
          {...fieldProps("cep")}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="00000-000"
          onChange={(event) => void handleCepChange(event.target.value)}
        />
        <FieldError id="cep-error" message={visibleError("cep")} />
        {cepHint ? (
          <p className="mt-2 text-sm text-stone-500">{cepHint}</p>
        ) : null}
      </div>

      <div>
        <label htmlFor="street" className={labelClass}>
          Rua
        </label>
        <input
          {...fieldProps("street")}
          maxLength={160}
          autoComplete="address-line1"
          onChange={(event) => setField("street", event.target.value)}
        />
        <FieldError id="street-error" message={visibleError("street")} />
      </div>

      <div>
        <label htmlFor="neighborhood" className={labelClass}>
          Bairro
        </label>
        <input
          {...fieldProps("neighborhood")}
          maxLength={120}
          onChange={(event) => setField("neighborhood", event.target.value)}
        />
        <FieldError
          id="neighborhood-error"
          message={visibleError("neighborhood")}
        />
      </div>

      <div>
        <label htmlFor="number" className={labelClass}>
          Número da casa
        </label>
        <input
          {...fieldProps("number")}
          inputMode="numeric"
          maxLength={7}
          placeholder="123"
          onChange={(event) =>
            setField(
              "number",
              event.target.value.replace(/[^\dA-Za-z]/g, "").slice(0, 7)
            )
          }
        />
        <FieldError id="number-error" message={visibleError("number")} />
      </div>

      <div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label htmlFor="city" className={labelClass}>
              Cidade
            </label>
            <input
              {...fieldProps("city")}
              maxLength={120}
              autoComplete="address-level2"
              onChange={(event) => setField("city", event.target.value)}
            />
          </div>
          <div className="w-24">
            <label htmlFor="state" className={labelClass}>
              UF
            </label>
            <input
              {...fieldProps("state")}
              maxLength={2}
              autoCapitalize="characters"
              autoComplete="address-level1"
              onChange={(event) =>
                setField(
                  "state",
                  event.target.value
                    .toUpperCase()
                    .replace(/[^A-Z]/g, "")
                    .slice(0, 2)
                )
              }
            />
          </div>
        </div>
        <FieldError id="city-error" message={visibleError("city")} />
        <FieldError id="state-error" message={visibleError("state")} />
      </div>
    </>
  );
}
