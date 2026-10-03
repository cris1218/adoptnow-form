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
