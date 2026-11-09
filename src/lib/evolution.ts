function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function toWhatsAppPhone(phone: string): string {
  const digits = onlyDigits(phone);
  if (!digits) return "";
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

function evolutionConfig() {
  const base = (process.env.EVOLUTION_API_URL ?? "").replace(/\/$/, "");
  const key = process.env.EVOLUTION_API_KEY ?? "";
  const instance =
    (process.env.EVOLUTION_INSTANCE ?? "").trim() || "petflow_hotel-do-ron-ron";
  return { base, key, instance };
}

export function isEvolutionConfigured(): boolean {
  const { base, key } = evolutionConfig();
  return Boolean(base && key);
}

export async function sendWhatsAppText(input: {
  phone: string;
  text: string;
}): Promise<void> {
  const { base, key, instance } = evolutionConfig();
  if (!base || !key) {
    throw new Error("Evolution API não configurada.");
  }

  const number = toWhatsAppPhone(input.phone);
  if (!number) {
    throw new Error("Telefone inválido para WhatsApp.");
  }

  const response = await fetch(`${base}/message/sendText/${instance}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: key,
    },
    body: JSON.stringify({
      number,
      text: input.text,
      linkPreview: false,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Evolution ${response.status}: ${body.slice(0, 240)}`);
  }
}
