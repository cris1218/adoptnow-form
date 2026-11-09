export type RaffleStatus = "open" | "closed" | "drawn";
export type RaffleNumberStatus = "available" | "reserved" | "paid";

export type RaffleOrderStatus =
  | "awaiting_payment"
  | "pending_review"
  | "paid"
  | "rejected"
  | "expired";

export type PublicRaffle = {
  id: string;
  title: string;
  itemsDescription: string;
  priceCents: number;
  numbersCount: number;
  photoUrls: string[];
  status: RaffleStatus;
  drawnNumber: number | null;
  winnerName: string | null;
  publicToken: string;
  drawAt: string | null;
};

export type PublicRaffleNumber = {
  number: number;
  status: RaffleNumberStatus;
};

export type BuyerOrder = {
  id: string;
  status: RaffleOrderStatus;
  numbers: number[];
  totalCents: number;
  pixCopyPaste: string;
  pixQrBase64: string;
  paymentProofUrl: string;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
  buyerPhone?: string;
  buyerName?: string;
};

export function formatCentsBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export function mapPublicRaffle(raw: Record<string, unknown>): PublicRaffle {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    itemsDescription: String(raw.items_description ?? ""),
    priceCents: Number(raw.price_cents ?? 0),
    numbersCount: Number(raw.numbers_count ?? 0),
    photoUrls: Array.isArray(raw.photo_urls)
      ? (raw.photo_urls as string[])
      : [],
    status: raw.status as RaffleStatus,
    drawnNumber: raw.drawn_number == null ? null : Number(raw.drawn_number),
    winnerName: (() => {
      const name = String(raw.winner_name ?? "").trim();
      return name || null;
    })(),
    publicToken: String(raw.public_token ?? ""),
    drawAt: raw.draw_at == null ? null : String(raw.draw_at),
  };
}

export function mapPublicNumbers(raw: unknown): PublicRaffleNumber[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      number: Number(row.number),
      status: row.status as RaffleNumberStatus,
    };
  });
}

export function mapBuyerOrders(raw: unknown): BuyerOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const row = item as Record<string, unknown>;
    return {
      id: String(row.id ?? ""),
      status: row.status as BuyerOrder["status"],
      numbers: Array.isArray(row.numbers) ? (row.numbers as number[]) : [],
      totalCents: Number(row.total_cents ?? 0),
      pixCopyPaste: String(row.pix_copy_paste ?? ""),
      pixQrBase64: String(row.pix_qr_base64 ?? ""),
      paymentProofUrl: String(row.payment_proof_url ?? ""),
      expiresAt: row.expires_at == null ? null : String(row.expires_at),
      paidAt: row.paid_at == null ? null : String(row.paid_at),
      createdAt: row.created_at == null ? null : String(row.created_at),
      buyerName: row.buyer_name == null ? undefined : String(row.buyer_name),
      buyerPhone: row.buyer_phone == null ? undefined : String(row.buyer_phone),
    };
  });
}

/** Usado só na V2 (Mercado Pago). Mantido para o módulo não quebrar o build. */
export function technicalPayerEmail(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return `rifa+${digits}@recantoronron.invalid`;
}
