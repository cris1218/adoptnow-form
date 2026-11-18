/**
 * Taxa MP Checkout Transparente · crédito · recebimento na hora (D0).
 * O comprador/doador paga a taxa: cobramos ceil(líquido / (1 - taxa)).
 */
export const MP_CARD_FEE_RATE = 0.0498;
/** Basis points da taxa (4,98% → 498) para aritmética inteira estável. */
export const MP_CARD_FEE_BPS = 498;

/** Valor cobrado no cartão para que o líquido após a taxa ≈ valor da compra/doação. */
export function cardChargeCentsFromNet(netCents: number): number {
  const net = Math.max(0, Math.floor(netCents));
  if (net <= 0) return 0;
  const denominator = 10_000 - MP_CARD_FEE_BPS;
  return Math.ceil((net * 10_000) / denominator);
}

export function cardFeeCentsFromNet(netCents: number): number {
  const net = Math.max(0, Math.floor(netCents));
  return Math.max(0, cardChargeCentsFromNet(net) - net);
}

/** @deprecated Use cardChargeCentsFromNet */
export const cardChargeCentsFromDonation = cardChargeCentsFromNet;
/** @deprecated Use cardFeeCentsFromNet */
export const cardFeeCentsFromDonation = cardFeeCentsFromNet;
export const VAQUINHA_CARD_FEE_RATE = MP_CARD_FEE_RATE;
export const VAQUINHA_CARD_FEE_BPS = MP_CARD_FEE_BPS;
