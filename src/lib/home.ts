export type HomeRaffleCard = {
  id: string;
  title: string;
  itemsDescription: string;
  priceCents: number;
  numbersCount: number;
  photoUrls: string[];
  publicToken: string;
  drawAt: string | null;
};

export type HomeVaquinhaCard = {
  id: string;
  title: string;
  description: string;
  goalCents: number;
  raisedCents: number;
  paidCount: number;
  photoUrls: string[];
  publicToken: string;
  endsAt: string | null;
};

export function mapHomeRaffle(raw: Record<string, unknown>): HomeRaffleCard {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    itemsDescription: String(raw.items_description ?? ""),
    priceCents: Number(raw.price_cents ?? 0),
    numbersCount: Number(raw.numbers_count ?? 0),
    photoUrls: Array.isArray(raw.photo_urls)
      ? (raw.photo_urls as string[])
      : [],
    publicToken: String(raw.public_token ?? ""),
    drawAt: raw.draw_at == null ? null : String(raw.draw_at),
  };
}

export function mapHomeVaquinha(
  raw: Record<string, unknown>
): HomeVaquinhaCard {
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
    publicToken: String(raw.public_token ?? ""),
    endsAt: raw.ends_at == null ? null : String(raw.ends_at),
  };
}

export function homeProgressPercent(
  raisedCents: number,
  goalCents: number
): number {
  if (goalCents <= 0) return 0;
  return Math.min(100, Math.round((raisedCents / goalCents) * 100));
}
