"use server";

import { buildPixCopyPaste, buildPixQrBase64 } from "@/lib/pixBrCode";
import {
  mapBuyerOrders,
  mapPublicNumbers,
  mapPublicRaffle,
  type BuyerOrder,
  type PublicRaffle,
  type PublicRaffleNumber,
} from "@/lib/raffles";
import { isValidPhone, normalizePhone } from "@/lib/masks";
import { notifyStaffRafflePaymentProof } from "@/lib/notifyStaff";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabase";

function adminOrThrow() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return admin;
}

export async function loadRafflePublic(token: string): Promise<{
  ok: boolean;
  message?: string;
  raffle?: PublicRaffle;
  numbers?: PublicRaffleNumber[];
}> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_raffle_public", {
    p_token: token.trim(),
  });
  if (error) {
    console.error("get_raffle_public", error);
    return { ok: false, message: "Não foi possível carregar a rifa." };
  }
  const payload = data as {
    ok?: boolean;
    message?: string;
    raffle?: Record<string, unknown>;
    numbers?: unknown;
  } | null;
  if (!payload?.ok || !payload.raffle) {
    return {
      ok: false,
      message: payload?.message || "Rifa não encontrada.",
    };
  }
  return {
    ok: true,
    raffle: mapPublicRaffle(payload.raffle),
    numbers: mapPublicNumbers(payload.numbers),
  };
}

export async function lookupRaffleOrdersByPhone(
  token: string,
  phone: string
): Promise<{ ok: boolean; orders: BuyerOrder[]; message?: string }> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_raffle_orders_by_phone", {
    p_token: token.trim(),
    p_phone: normalizePhone(phone),
  });
  if (error) {
    console.error("get_raffle_orders_by_phone", error);
    return { ok: false, orders: [], message: "Falha ao buscar pedidos." };
  }
  const payload = data as { ok?: boolean; orders?: unknown } | null;
  return {
    ok: Boolean(payload?.ok),
    orders: mapBuyerOrders(payload?.orders),
  };
}

export async function purchaseRaffleNumbers(input: {
  token: string;
  numbers: number[];
  buyerName: string;
  buyerPhone: string;
}): Promise<{
  ok: boolean;
  message?: string;
  order?: BuyerOrder;
}> {
  const phone = normalizePhone(input.buyerPhone);
  const name = input.buyerName.trim();
  if (name.length < 2) {
    return { ok: false, message: "Informe o nome." };
  }
  if (!isValidPhone(phone)) {
    return { ok: false, message: "Informe um WhatsApp válido com DDD." };
  }
  if (!input.numbers.length) {
    return { ok: false, message: "Selecione ao menos um número." };
  }

  try {
    const admin = adminOrThrow();
    const { data, error } = await admin.rpc("reserve_raffle_numbers", {
      p_token: input.token.trim(),
      p_numbers: input.numbers,
      p_buyer_name: name,
      p_buyer_phone: phone,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível reservar os números.",
      };
    }

    const reserved = data as {
      ok?: boolean;
      order_id?: string;
      total_cents?: number;
      numbers?: number[];
      expires_at?: string;
      buyer_name?: string;
      buyer_phone?: string;
      pix_key?: string;
      title?: string;
    } | null;

    if (!reserved?.ok || !reserved.order_id || !reserved.pix_key) {
      return { ok: false, message: "Não foi possível reservar os números." };
    }

    const pixCopyPaste = buildPixCopyPaste({
      pixKey: reserved.pix_key,
      amountCents: Number(reserved.total_cents ?? 0),
      description: `RIFA${String(reserved.order_id).replace(/-/g, "").slice(0, 20)}`,
    });
    const pixQrBase64 = await buildPixQrBase64(pixCopyPaste);

    const { error: attachError } = await admin.rpc(
      "attach_raffle_order_pix_static",
      {
        p_order_id: reserved.order_id,
        p_pix_copy_paste: pixCopyPaste,
      }
    );

    if (attachError) {
      console.error("attach_raffle_order_pix_static", attachError);
      return {
        ok: false,
        message:
          attachError.message ||
          "Reserva ok, mas falhou ao montar o Pix. Fale conosco.",
      };
    }

    return {
      ok: true,
      order: {
        id: reserved.order_id,
        status: "awaiting_payment",
        numbers: reserved.numbers ?? input.numbers,
        totalCents: Number(reserved.total_cents ?? 0),
        pixCopyPaste,
        pixQrBase64,
        paymentProofUrl: "",
        expiresAt: reserved.expires_at ?? null,
        paidAt: null,
        createdAt: null,
      },
    };
  } catch (error) {
    console.error("purchaseRaffleNumbers", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o Pix agora.",
    };
  }
}

export async function submitRafflePaymentProof(input: {
  token: string;
  orderId: string;
  buyerPhone: string;
  paymentProofUrl: string;
}): Promise<{ ok: boolean; message?: string; order?: BuyerOrder }> {
  const phone = normalizePhone(input.buyerPhone);
  const url = input.paymentProofUrl.trim();
  if (!isValidPhone(phone)) {
    return { ok: false, message: "Informe um WhatsApp válido com DDD." };
  }
  if (!url) {
    return { ok: false, message: "Anexe o comprovante." };
  }

  try {
    const admin = adminOrThrow();
    const { data, error } = await admin.rpc("attach_raffle_order_payment_proof", {
      p_token: input.token.trim(),
      p_order_id: input.orderId,
      p_phone: phone,
      p_payment_proof_url: url,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível enviar o comprovante.",
      };
    }

    const payload = data as { ok?: boolean; status?: string } | null;
    if (!payload?.ok) {
      return { ok: false, message: "Não foi possível enviar o comprovante." };
    }

    const lookup = await lookupRaffleOrdersByPhone(input.token, phone);
    const order = lookup.orders.find((item) => item.id === input.orderId);

    try {
      await notifyStaffRafflePaymentProof({
        orderId: input.orderId,
        phone,
      });
    } catch (pushError) {
      console.error("notifyStaffRafflePaymentProof", pushError);
    }

    return {
      ok: true,
      order: order
        ? { ...order, status: "pending_review", paymentProofUrl: url }
        : undefined,
      message: "Comprovante enviado. Aguarde a confirmação.",
    };
  } catch (error) {
    console.error("submitRafflePaymentProof", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível enviar o comprovante.",
    };
  }
}
