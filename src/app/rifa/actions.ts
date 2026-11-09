"use server";

import {
  createPixPayment,
} from "@/lib/mercadopago";
import {
  mapBuyerOrders,
  mapPublicNumbers,
  mapPublicRaffle,
  type BuyerOrder,
  type PublicRaffle,
  type PublicRaffleNumber,
} from "@/lib/raffles";
import { isValidPhone, normalizePhone } from "@/lib/masks";
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
    } | null;

    if (!reserved?.ok || !reserved.order_id) {
      return { ok: false, message: "Não foi possível reservar os números." };
    }

    const publicData = await loadRafflePublic(input.token);
    const title = publicData.raffle?.title ?? "Rifa";

    const pix = await createPixPayment({
      orderId: reserved.order_id,
      amountCents: Number(reserved.total_cents ?? 0),
      description: `${title} · números ${(reserved.numbers ?? []).join(", ")}`,
      buyerPhone: phone,
    });

    const { error: attachError } = await admin.rpc("attach_raffle_order_pix", {
      p_order_id: reserved.order_id,
      p_mp_payment_id: pix.id,
      p_pix_copy_paste: pix.qrCode,
      p_pix_qr_base64: pix.qrCodeBase64,
    });

    if (attachError) {
      console.error("attach_raffle_order_pix", attachError);
      return {
        ok: false,
        message: "Pix criado, mas falhou ao salvar. Guarde o pedido e fale conosco.",
      };
    }

    return {
      ok: true,
      order: {
        id: reserved.order_id,
        status: "pending",
        numbers: reserved.numbers ?? input.numbers,
        totalCents: Number(reserved.total_cents ?? 0),
        pixCopyPaste: pix.qrCode,
        pixQrBase64: pix.qrCodeBase64,
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
