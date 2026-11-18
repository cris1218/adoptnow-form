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

/**
 * Taxa MP Checkout Transparente · crédito · recebimento na hora (D0).
 * O doador paga a taxa: cobramos ceil(doação / (1 - taxa)) para o líquido ≈ doação.
 */
export const VAQUINHA_CARD_FEE_RATE = 0.0498;
/** Basis points da taxa (4,98% → 498) para aritmética inteira estável. */
export const VAQUINHA_CARD_FEE_BPS = 498;

/** Valor cobrado no cartão para que o líquido após a taxa ≈ doação. */
export function cardChargeCentsFromDonation(donationCents: number): number {
  const donation = Math.max(0, Math.floor(donationCents));
  if (donation <= 0) return 0;
  const denominator = 10_000 - VAQUINHA_CARD_FEE_BPS;
  return Math.ceil((donation * 10_000) / denominator);
}

export function cardFeeCentsFromDonation(donationCents: number): number {
  const donation = Math.max(0, Math.floor(donationCents));
  return Math.max(0, cardChargeCentsFromDonation(donation) - donation);
}

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
