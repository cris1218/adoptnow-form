import { maskCep, onlyDigits } from "@/lib/masks";

export type CepAddress = {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
};

function isComplete(address: CepAddress): boolean {
  return Boolean(
    address.street.trim() &&
      address.city.trim() &&
      address.state.trim()
  );
}

async function fetchJson(url: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 4000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    window.clearTimeout(timer);
  }
}

function fromViaCep(data: unknown, digits: string): CepAddress | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    erro?: boolean;
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
  };
  if (row.erro) return null;
  if (!row.localidade && !row.logradouro) return null;

  return {
    cep: maskCep(digits),
    street: row.logradouro?.trim() ?? "",
    neighborhood: row.bairro?.trim() ?? "",
    city: row.localidade?.trim() ?? "",
    state: (row.uf ?? "").trim().toUpperCase(),
  };
}

function fromBrasilApi(data: unknown, digits: string): CepAddress | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    street?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    message?: string;
  };
  if (row.message && !row.city) return null;

  return {
    cep: maskCep(digits),
    street: row.street?.trim() ?? "",
    neighborhood: row.neighborhood?.trim() ?? "",
    city: row.city?.trim() ?? "",
    state: (row.state ?? "").trim().toUpperCase(),
  };
}

function fromOpenCep(data: unknown, digits: string): CepAddress | null {
  if (!data || typeof data !== "object") return null;
  const row = data as {
    logradouro?: string;
    bairro?: string;
    localidade?: string;
    uf?: string;
    error?: boolean;
  };
  if (row.error) return null;

  return {
    cep: maskCep(digits),
    street: row.logradouro?.trim() ?? "",
    neighborhood: row.bairro?.trim() ?? "",
    city: row.localidade?.trim() ?? "",
    state: (row.uf ?? "").trim().toUpperCase(),
  };
}

export async function fetchAddressByCep(cep: string): Promise<CepAddress> {
  const digits = onlyDigits(cep);
  if (digits.length !== 8) {
    throw new Error("Informe um CEP válido com 8 dígitos.");
  }

  const sources = [
    () =>
      fetchJson(`https://viacep.com.br/ws/${digits}/json/`).then((data) =>
        fromViaCep(data, digits)
      ),
    () =>
      fetchJson(`https://brasilapi.com.br/api/cep/v2/${digits}`).then((data) =>
        fromBrasilApi(data, digits)
      ),
    () =>
      fetchJson(`https://opencep.com/v1/${digits}`).then((data) =>
        fromOpenCep(data, digits)
      ),
  ];

  for (const load of sources) {
    const address = await load();
    if (address && isComplete(address)) return address;
    if (address?.city) return address;
  }

  throw new Error("CEP não encontrado.");
}
