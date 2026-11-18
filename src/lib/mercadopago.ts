import { technicalPayerEmail } from "@/lib/raffles";

const MP_API = "https://api.mercadopago.com";

export type MercadoPagoPixPayment = {
  id: string;
  status: string;
  transactionAmount: number;
  externalReference: string;
  qrCode: string;
  qrCodeBase64: string;
  ticketUrl: string;
};

/** MP Pix exige expiração entre 30 min e 30 dias. */
const MP_PIX_MIN_EXPIRATION_MINUTES = 30;

function mpErrorMessage(
  payload: Record<string, unknown>,
  status: number
): string {
  const cause = payload.cause;
  if (Array.isArray(cause) && cause.length > 0) {
    const first = cause[0] as { description?: unknown; message?: unknown };
    if (typeof first?.description === "string" && first.description.trim()) {
      return first.description.trim();
    }
    if (typeof first?.message === "string" && first.message.trim()) {
      return first.message.trim();
    }
  }
  if (typeof payload.message === "string" && payload.message.trim()) {
    return payload.message.trim();
  }
  return `Mercado Pago ${status}`;
}

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
  notificationUrl: string;
}): Promise<{ ok: true; payment: MercadoPagoPixPayment } | { ok: false; message: string }> {
  const expires = new Date(
    Date.now() + input.expirationMinutes * 60_000
  ).toISOString();
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
      date_of_expiration: expires,
      payer: {
        email: technicalPayerEmail(input.buyerPhone),
      },
      external_reference: input.orderId,
      notification_url: input.notificationUrl,
    }),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    console.error("mercadopago create pix", response.status, payload);
    return {
      ok: false,
      message: mpErrorMessage(payload, response.status),
    };
  }

  const tx = payload.point_of_interaction as
    | {
        transaction_data?: {
          qr_code?: string;
          qr_code_base64?: string;
          ticket_url?: string;
        };
      }
    | undefined;
  const qrCode = tx?.transaction_data?.qr_code ?? "";
  const qrCodeBase64 = tx?.transaction_data?.qr_code_base64 ?? "";
  const ticketUrl = tx?.transaction_data?.ticket_url ?? "";

  if (!qrCode && !ticketUrl) {
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
      ticketUrl,
    },
  };
}

export async function createPixPayment(input: {
  orderId: string;
  amountCents: number;
  description: string;
  buyerPhone: string;
  /**
   * Expiração no MP (mín. 30 min). A reserva no site/DB continua em 5 min.
   */
  expirationMinutes?: number;
  /** Default: webhook das rifas. */
  notificationUrl?: string;
}): Promise<MercadoPagoPixPayment> {
  const amount = Number((input.amountCents / 100).toFixed(2));
  if (!(amount >= 0.01)) {
    throw new Error("Valor do Pix inválido.");
  }
  const minutes = Math.max(
    MP_PIX_MIN_EXPIRATION_MINUTES,
    Math.min(
      input.expirationMinutes ?? MP_PIX_MIN_EXPIRATION_MINUTES,
      60 * 24 * 30
    )
  );

  const result = await postPixPayment({
    orderId: input.orderId,
    amount,
    description: input.description,
    buyerPhone: input.buyerPhone,
    expirationMinutes: minutes,
    idempotencyKey: input.orderId,
    notificationUrl:
      input.notificationUrl?.trim() || `${siteUrl()}/api/rifas/webhook`,
  });
  if (result.ok) return result.payment;
  throw new Error(result.message);
}

export type MercadoPagoCardPayment = {
  id: string;
  status: string;
  statusDetail: string;
  transactionAmount: number;
  externalReference: string;
};

export async function createCardPayment(input: {
  orderId: string;
  amountCents: number;
  description: string;
  token: string;
  paymentMethodId: string;
  installments?: number;
  issuerId?: string | number | null;
  buyerPhone: string;
  notificationUrl?: string;
}): Promise<MercadoPagoCardPayment> {
  const amount = Number((input.amountCents / 100).toFixed(2));
  if (!(amount >= 0.01)) {
    throw new Error("Valor do cartão inválido.");
  }
  const token = input.token.trim();
  const paymentMethodId = input.paymentMethodId.trim();
  if (!token || !paymentMethodId) {
    throw new Error("Dados do cartão incompletos.");
  }

  // Parcela mínima R$ 100: 2x só a partir de R$ 200, etc.
  const maxInstallments = Math.max(1, Math.floor(input.amountCents / 10_000));
  const installments = Math.max(
    1,
    Math.min(input.installments ?? 1, maxInstallments)
  );
  const body: Record<string, unknown> = {
    transaction_amount: amount,
    token,
    description: input.description.slice(0, 200),
    installments,
    payment_method_id: paymentMethodId,
    payer: {
      email: technicalPayerEmail(input.buyerPhone),
    },
    external_reference: input.orderId,
    notification_url:
      input.notificationUrl?.trim() ||
      `${siteUrl()}/api/vaquinhas/webhook`,
  };

  const issuerId =
    input.issuerId == null || input.issuerId === ""
      ? null
      : String(input.issuerId);
  if (issuerId) {
    body.issuer_id = Number.isFinite(Number(issuerId))
      ? Number(issuerId)
      : issuerId;
  }

  const response = await fetch(`${MP_API}/v1/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken()}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": `${input.orderId}-card`,
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    console.error("mercadopago create card", response.status, payload);
    throw new Error(mpErrorMessage(payload, response.status));
  }

  const id = String(payload.id ?? "").trim();
  if (!id) {
    throw new Error("Mercado Pago não retornou o pagamento.");
  }

  return {
    id,
    status: String(payload.status ?? ""),
    statusDetail: String(payload.status_detail ?? ""),
    transactionAmount: Number(payload.transaction_amount ?? 0),
    externalReference: String(payload.external_reference ?? ""),
  };
}

export function mercadopagoPublicKey(): string {
  return process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";
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
