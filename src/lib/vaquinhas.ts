export type VaquinhaStatus = "open" | "closed";

export type VaquinhaOrderStatus = "awaiting_payment" | "paid" | "expired";

export type VaquinhaPaymentMethod = "pix" | "credit_card";

export type PublicVaquinha = {
  id: string;
  title: string;
  description: string;
  goalCents: number;
  raisedCents: number;
  paidCount: number;
  photoUrls: string[];
  status: VaquinhaStatus;
  acceptsDonations: boolean;
  endsAt: string | null;
  publicToken: string;
};

export type DonationOrder = {
  id: string;
  status: VaquinhaOrderStatus;
  amountCents: number;
  isAnonymous: boolean;
  donorName: string;
  donorPhone: string;
  paymentMethod: VaquinhaPaymentMethod;
  pixCopyPaste: string;
  pixQrBase64: string;
  pixTicketUrl?: string;
  expiresAt: string | null;
  paidAt: string | null;
  createdAt: string | null;
};

export function mapPaymentMethod(raw: unknown): VaquinhaPaymentMethod {
  return raw === "credit_card" ? "credit_card" : "pix";
}

export function formatCentsBrl(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export {
  MP_CARD_FEE_BPS as VAQUINHA_CARD_FEE_BPS,
  MP_CARD_FEE_RATE as VAQUINHA_CARD_FEE_RATE,
  cardChargeCentsFromDonation,
  cardFeeCentsFromDonation,
} from "@/lib/mpFees";

export function vaquinhaProgressPercent(
  raisedCents: number,
  goalCents: number
): number {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.round((raisedCents / goalCents) * 100));
}

export function mapPublicVaquinha(raw: Record<string, unknown>): PublicVaquinha {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    description: String(raw.description ?? ""),
    goalCents: Number(raw.goal_cents ?? 0),
    raisedCents: Number(raw.raised_cents ?? 0),
    paidCount: Number(raw.paid_count ?? 0),
    photoUrls: Array.isArray(raw.photo_urls)
      ? (raw.photo_urls as string[])
      : [],
    status: raw.status as VaquinhaStatus,
    acceptsDonations: Boolean(raw.accepts_donations),
    endsAt: raw.ends_at == null ? null : String(raw.ends_at),
    publicToken: String(raw.public_token ?? ""),
  };
}
