"use server";

import { createPixPayment } from "@/lib/mercadopago";
import {
  mapBuyerOrders,
  mapPublicNumbers,
  mapPublicRaffle,
  type BuyerOrder,
  type PublicRaffle,
  type PublicRaffleNumber,
} from "@/lib/raffles";
import {
  fullNameError,
  normalizeFullName,
  normalizePhone,
  phoneError,
} from "@/lib/masks";
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
  const normalized = normalizePhone(phone);
  if (phoneError(normalized)) {
    return { ok: true, orders: [] };
  }

  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_raffle_orders_by_phone", {
    p_token: token.trim(),
    p_phone: normalized,
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
  const name = normalizeFullName(input.buyerName);
  const nameError = fullNameError(name);
  if (nameError) {
    return { ok: false, message: nameError };
  }
  const buyerPhoneError = phoneError(phone);
  if (buyerPhoneError) {
    return { ok: false, message: buyerPhoneError };
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
      title?: string;
    } | null;

    if (!reserved?.ok || !reserved.order_id) {
      return { ok: false, message: "Não foi possível reservar os números." };
    }

    const totalCents = Number(reserved.total_cents ?? 0);
    const title = String(reserved.title ?? "Rifa");

    const releaseReservedOrder = async () => {
      try {
        await admin
          .from("raffle_orders")
          .update({ expires_at: "1970-01-01T00:00:00" })
          .eq("id", reserved.order_id)
          .eq("status", "awaiting_payment");
        await admin.rpc("release_expired_raffle_orders", {
          p_raffle_id: null,
        });
      } catch (releaseError) {
        console.error("release after pix failure", releaseError);
      }
    };

    let pix;
    try {
      pix = await createPixPayment({
        orderId: reserved.order_id,
        amountCents: totalCents,
        description: `${title} · números ${(reserved.numbers ?? input.numbers).join(",")}`,
        buyerPhone: phone,
        expirationMinutes: 30,
      });
    } catch (pixError) {
      await releaseReservedOrder();
      throw pixError;
    }

    const { error: attachError } = await admin.rpc("attach_raffle_order_pix", {
      p_order_id: reserved.order_id,
      p_mp_payment_id: pix.id,
      p_pix_copy_paste: pix.qrCode,
      p_pix_qr_base64: pix.qrCodeBase64,
    });

    if (attachError) {
      console.error("attach_raffle_order_pix", attachError);
      await releaseReservedOrder();
      return {
        ok: false,
        message:
          attachError.message ||
          "Não foi possível montar o Pix. Tente de novo.",
      };
    }

    return {
      ok: true,
      order: {
        id: reserved.order_id,
        status: "awaiting_payment",
        numbers: reserved.numbers ?? input.numbers,
        totalCents,
        pixCopyPaste: pix.qrCode,
        pixQrBase64: pix.qrCodeBase64,
        pixTicketUrl: pix.ticketUrl || undefined,
        paymentProofUrl: "",
        expiresAt: reserved.expires_at ?? null,
        paidAt: null,
        createdAt: null,
        buyerPhone: phone,
        buyerName: name,
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

export async function getRaffleOrderPaymentStatus(input: {
  token: string;
  orderId: string;
}): Promise<{
  ok: boolean;
  status?: BuyerOrder["status"];
  message?: string;
  order?: BuyerOrder;
}> {
  try {
    const admin = adminOrThrow();
    await admin.rpc("release_expired_raffle_orders", {
      p_raffle_id: null,
    });

    const { data: orderRow, error } = await admin
      .from("raffle_orders")
      .select(
        "id, raffle_id, buyer_name, buyer_phone, numbers, total_cents, status, expires_at, paid_at, created_at, pix_copy_paste, pix_qr_base64, payment_proof_url"
      )
      .eq("id", input.orderId)
      .maybeSingle();

    if (error || !orderRow) {
      return { ok: false, message: "Pedido não encontrado." };
    }

    const { data: raffle } = await admin
      .from("raffles")
      .select("public_token")
      .eq("id", orderRow.raffle_id)
      .maybeSingle();

    if (!raffle?.public_token || raffle.public_token !== input.token.trim()) {
      return { ok: false, message: "Pedido não pertence a esta rifa." };
    }

    const order: BuyerOrder = {
      id: String(orderRow.id),
      status: orderRow.status as BuyerOrder["status"],
      numbers: Array.isArray(orderRow.numbers)
        ? (orderRow.numbers as number[])
        : [],
      totalCents: Number(orderRow.total_cents ?? 0),
      pixCopyPaste: String(orderRow.pix_copy_paste ?? ""),
      pixQrBase64: String(orderRow.pix_qr_base64 ?? ""),
      paymentProofUrl: String(orderRow.payment_proof_url ?? ""),
      expiresAt:
        orderRow.expires_at == null ? null : String(orderRow.expires_at),
      paidAt: orderRow.paid_at == null ? null : String(orderRow.paid_at),
      createdAt:
        orderRow.created_at == null ? null : String(orderRow.created_at),
      buyerPhone: String(orderRow.buyer_phone ?? ""),
      buyerName: String(orderRow.buyer_name ?? ""),
    };

    return { ok: true, status: order.status, order };
  } catch (error) {
    console.error("getRaffleOrderPaymentStatus", error);
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Falha ao consultar pedido.",
    };
  }
}
