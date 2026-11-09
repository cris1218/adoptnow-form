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

async function postPixPayment(input: {
  orderId: string;
  amount: number;
  description: string;
  buyerPhone: string;
  expirationMinutes: number;
  idempotencyKey: string;
}): Promise<{ ok: true; payment: MercadoPagoPixPayment } | { ok: false; message: string }> {
  const expires = new Date(Date.now() + input.expirationMinutes * 60_000);
  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      transaction_amount: input.amount,
      description: input.description.slice(0, 200),
      payment_method_id: "pix",
      date_of_expiration: expires.toISOString(),
      payer: {
        email: technicalPayerEmail(input.buyerPhone),
      },
      external_reference: input.orderId,
      notification_url: `${siteUrl()}/api/rifas/webhook`,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    return {
      ok: false,
      message:
        typeof payload.message === "string"
          ? payload.message
          : `Mercado Pago ${response.status}`,
    };
  }

  const tx = payload.point_of_interaction as
    | { transaction_data?: { qr_code?: string; qr_code_base64?: string } }
    | undefined;
  const qrCode = tx?.transaction_data?.qr_code ?? "";
  const qrCodeBase64 = tx?.transaction_data?.qr_code_base64 ?? "";

  if (!qrCode) {
    return { ok: false, message: "Mercado Pago não retornou o Pix." };
  }

  return {
    ok: true,
    payment: {
      id: String(payload.id ?? ""),
      status: String(payload.status ?? ""),
      transactionAmount: Number(payload.transaction_amount ?? 0),
      externalReference: String(payload.external_reference ?? ""),
      qrCode,
      qrCodeBase64,
    },
  };
}

export async function createPixPayment(input: {
  orderId: string;
  amountCents: number;
  description: string;
  buyerPhone: string;
  /** Minutos até o Pix expirar no MP (padrão 5; DB libera em 5). */
  expirationMinutes?: number;
}): Promise<MercadoPagoPixPayment> {
  const amount = Number((input.amountCents / 100).toFixed(2));
  const minutes = Math.max(5, Math.min(input.expirationMinutes ?? 5, 60 * 24));

  const first = await postPixPayment({
    orderId: input.orderId,
    amount,
    description: input.description,
    buyerPhone: input.buyerPhone,
    expirationMinutes: minutes,
    idempotencyKey: input.orderId,
  });
  if (first.ok) return first.payment;

  // Contas MP às vezes rejeitam expiração curta; tenta 30 min (site/DB ainda cortam em 5).
  if (minutes < 30) {
    const second = await postPixPayment({
      orderId: input.orderId,
      amount,
      description: input.description,
      buyerPhone: input.buyerPhone,
      expirationMinutes: 30,
      idempotencyKey: `${input.orderId}:30m`,
    });
    if (second.ok) return second.payment;
    throw new Error(second.message);
  }

  throw new Error(first.message);
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
