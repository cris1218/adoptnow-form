import { technicalPayerEmail } from "@/lib/raffles";

const MP_API = "https://api.mercadopago.com";

export type MercadoPagoPixPayment = {
  id: string;
  status: string;
  transactionAmount: number;
  externalReference: string;
  qrCode: string;
  qrCodeBase64: string;
};

function accessToken(): string {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error(
      "MERCADOPAGO_ACCESS_TOKEN não configurado na Vercel / .env.local."
    );
  }
  return token;
}

function siteUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://recantoronron.vercel.app"
  );
}

export async function createPixPayment(input: {
  orderId: string;
  amountCents: number;
  description: string;
  buyerPhone: string;
}): Promise<MercadoPagoPixPayment> {
  const amount = Number((input.amountCents / 100).toFixed(2));
  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.orderId,
    },
    body: JSON.stringify({
      transaction_amount: amount,
      description: input.description.slice(0, 200),
      payment_method_id: "pix",
      payer: {
        email: technicalPayerEmail(input.buyerPhone),
      },
      external_reference: input.orderId,
      notification_url: `${siteUrl()}/api/rifas/webhook`,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const message =
      typeof payload.message === "string"
        ? payload.message
        : `Mercado Pago ${response.status}`;
    throw new Error(message);
  }

  const tx = payload.point_of_interaction as
    | { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
    | undefined;
  const qrCode = tx?.transaction_data?.qr_code ?? "";
  const qrCodeBase64 = tx?.transaction_data?.qr_code_base64 ?? "";

  if (!qrCode) {
    throw new Error("Mercado Pago não retornou o Pix.");
  }

  return {
    id: String(payload.id ?? ""),
    status: String(payload.status ?? ""),
    transactionAmount: Number(payload.transaction_amount ?? 0),
    externalReference: String(payload.external_reference ?? ""),
    qrCode,
    qrCodeBase64,
  };
}

export async function fetchMercadoPagoPayment(
  paymentId: string
): Promise<{
  id: string;
  status: string;
  transactionAmountCents: number;
  externalReference: string;
}> {
  const response = await fetch(`${MP_API}/v1/payments/${paymentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken()}`,
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error(
      typeof payload.message === "string"
        ? payload.message
        : `Falha ao consultar pagamento ${paymentId}`
    );
  }

  const amount = Number(payload.transaction_amount ?? 0);
  return {
    id: String(payload.id ?? ""),
    status: String(payload.status ?? ""),
    transactionAmountCents: Math.round(amount * 100),
    externalReference: String(payload.external_reference ?? ""),
  };
}

/** Valida x-signature do webhook quando o segredo estiver configurado. */
export async function verifyMercadoPagoWebhookSignature(input: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
}): Promise<boolean> {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  if (!input.xSignature || !input.xRequestId) return false;

  const parts = Object.fromEntries(
    input.xSignature.split(",").map((chunk) => {
      const [key, value] = chunk.split("=");
      return [key.trim(), (value ?? "").trim()];
    })
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${input.dataId};request-id:${input.xRequestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(manifest)
  );
  const hex = [...new Uint8Array(signature)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex === v1;
}
