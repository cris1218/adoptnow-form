export function getFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return "";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function normalizePhone(value: string): string {
  let digits = onlyDigits(value);

  if (
    digits.startsWith("55") &&
    (digits.length === 12 || digits.length === 13)
  ) {
    digits = digits.slice(2);
  }

  return digits.slice(0, 11);
}

export function maskPhone(value: string): string {
  const digits = normalizePhone(value);

  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidPhone(value: string): boolean {
  const digits = normalizePhone(value);
  return digits.length === 10 || digits.length === 11;
}

export function isValidName(value: string): boolean {
  const name = value.trim();
  return name.length >= 2 && name.length <= 120;
}

export function normalizeFullName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

const NAME_CONNECTORS = new Set(["da", "das", "de", "do", "dos", "e"]);

export function fullNameError(value: string): string {
  const name = normalizeFullName(value);
  if (!name) return "Informe seu nome completo.";
  if (name.length > 120) return "O nome pode ter no máximo 120 caracteres.";
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ'’\-. ]*$/.test(name)) {
    return "Use apenas letras no nome, sem números ou símbolos.";
  }

  const words = name
    .split(" ")
    .filter((word) => !NAME_CONNECTORS.has(word.toLowerCase()));
  if (words.length < 2) return "Informe nome e sobrenome.";
  if (words.some((word) => word.replace(/[^A-Za-zÀ-ÖØ-öø-ÿ]/g, "").length < 2)) {
    return "Nome e sobrenome precisam ter pelo menos 2 letras cada.";
  }
  return "";
}

export function isValidFullName(value: string): boolean {
  return fullNameError(value) === "";
}

const CAT_NAME_PLACEHOLDERS = new Set([
  "nao",
  "naosei",
  "sei",
  "sem",
  "semnome",
  "nenhum",
  "nenhuma",
  "nada",
  "desconhecido",
  "desconhecida",
  "qualquer",
  "qualquerum",
  "gato",
  "gata",
  "gatinho",
  "gatinha",
  "gatos",
  "filhote",
  "nome",
  "outro",
  "outra",
  "outros",
  "teste",
  "test",
  "xxx",
  "asdf",
]);

export function normalizeCatName(value: string): string {
  return value.trim();
}

export function catNameError(value: string): string {
  const name = normalizeCatName(value);
  if (!name) return "Informe o nome do gatinho.";
  if (/\s/.test(name)) {
    return "Informe só um nome, sem espaços (ex.: Juarez).";
  }
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ]+$/.test(name)) {
    return "Use apenas letras no nome do gatinho.";
  }
  if (name.length < 2) return "O nome do gatinho precisa ter pelo menos 2 letras.";
  if (name.length > 30) return "O nome do gatinho pode ter no máximo 30 letras.";

  const plain = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (CAT_NAME_PLACEHOLDERS.has(plain) || /^(.)\1+$/.test(plain)) {
    return "Informe o nome de verdade do gatinho que você quer adotar.";
  }
  return "";
}

export function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }

  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

export function maskCep(value: string): string {
  const digits = onlyDigits(value).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

  const checkDigit = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i += 1) {
      sum += Number(digits[i]) * (length + 1 - i);
    }
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };

  return (
    checkDigit(9) === Number(digits[9]) && checkDigit(10) === Number(digits[10])
  );
}

export function cpfError(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return "Informe seu CPF.";
  if (digits.length !== 11) return "O CPF precisa ter 11 dígitos.";
  if (!isValidCpf(digits)) return "CPF inválido. Confira os números.";
  return "";
}

export function isValidCep(value: string): boolean {
  const digits = onlyDigits(value);
  return digits.length === 8 && digits !== "00000000";
}

export function cepError(value: string): string {
  const digits = onlyDigits(value);
  if (!digits) return "Informe seu CEP.";
  if (!isValidCep(digits)) return "O CEP precisa ter 8 dígitos.";
  return "";
}

export function isValidHouseNumber(value: string): boolean {
  return /^\d{1,6}[A-Za-z]?$/.test(value.trim());
}

export function houseNumberError(value: string): string {
  if (!value.trim()) return "Informe o número da casa.";
  if (!isValidHouseNumber(value)) {
    return "Use apenas números no número da casa (ex.: 123 ou 123A).";
  }
  return "";
}
