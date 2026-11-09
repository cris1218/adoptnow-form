import {
  cepError,
  cpfError,
  houseNumberError,
  onlyDigits,
} from "@/lib/masks";

export type IdentityAddress = {
  document: string;
  cep: string;
  street: string;
  neighborhood: string;
  number: string;
  city: string;
  state: string;
};

export function textFieldError(
  value: string,
  emptyMessage: string,
  minLength = 2
): string {
  const trimmed = value.trim();
  if (!trimmed) return emptyMessage;
  if (trimmed.length < minLength) {
    return `Informe pelo menos ${minLength} caracteres.`;
  }
  return "";
}

export function ufError(value: string): string {
  if (!value.trim()) return "Informe a UF.";
  if (!/^[A-Z]{2}$/.test(value)) return "Use a sigla do estado (ex.: RS).";
  return "";
}

export function identityAddressErrors(
  values: IdentityAddress
): Record<keyof IdentityAddress, string> {
  return {
    document: cpfError(values.document),
    cep: cepError(values.cep),
    street: textFieldError(values.street, "Informe a rua."),
    neighborhood: textFieldError(values.neighborhood, "Informe o bairro."),
    number: houseNumberError(values.number),
    city: textFieldError(values.city, "Informe a cidade."),
    state: ufError(values.state),
  };
}

export function parseIdentityAddress(formData: FormData): {
  values: IdentityAddress;
  error: string;
} {
  const values: IdentityAddress = {
    document: onlyDigits(String(formData.get("document") ?? "")),
    cep: onlyDigits(String(formData.get("cep") ?? "")),
    street: String(formData.get("street") ?? "").trim(),
    neighborhood: String(formData.get("neighborhood") ?? "").trim(),
    number: String(formData.get("number") ?? "").trim(),
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim().toUpperCase(),
  };
  const error =
    Object.values(identityAddressErrors(values)).find(Boolean) ?? "";
  return { values, error };
}

export function normalizeIdentityAddress(
  values: Partial<IdentityAddress> | null | undefined
): IdentityAddress {
  return {
    document: onlyDigits(values?.document ?? ""),
    cep: onlyDigits(values?.cep ?? ""),
    street: (values?.street ?? "").trim(),
    neighborhood: (values?.neighborhood ?? "").trim(),
    number: (values?.number ?? "").trim(),
    city: (values?.city ?? "").trim(),
    state: (values?.state ?? "").trim().toUpperCase(),
  };
}

export function isIdentityAddressComplete(values: IdentityAddress): boolean {
  return Object.values(identityAddressErrors(values)).every((error) => !error);
}

export function identityAddressesEqual(
  left: IdentityAddress,
  right: IdentityAddress
): boolean {
  const a = normalizeIdentityAddress(left);
  const b = normalizeIdentityAddress(right);
  return (
    a.cep.length === 8 &&
    b.cep.length === 8 &&
    a.cep === b.cep &&
    a.street.toLowerCase() === b.street.toLowerCase() &&
    a.neighborhood.toLowerCase() === b.neighborhood.toLowerCase() &&
    a.number.toLowerCase() === b.number.toLowerCase() &&
    a.city.toLowerCase() === b.city.toLowerCase() &&
    a.state === b.state &&
    a.street.length > 0 &&
    b.street.length > 0
  );
}
