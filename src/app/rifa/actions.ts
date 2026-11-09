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
import {
  fullNameError,
  normalizeFullName,
  normalizePhone,
  phoneError,
} from "@/lib/masks";
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

export async function submitRafflePaymentProof(input: {
  token: string;
  orderId: string;
  buyerPhone: string;
  paymentProofUrl: string;
}): Promise<{ ok: boolean; message?: string; order?: BuyerOrder }> {
  const url = input.paymentProofUrl.trim();
  if (!url) {
    return { ok: false, message: "Anexe o comprovante." };
  }
  if (!input.orderId) {
    return { ok: false, message: "Pedido inválido. Gere o Pix novamente." };
  }

  try {
    const admin = adminOrThrow();
    const token = input.token.trim();

    const { data: orderRow, error: orderError } = await admin
      .from("raffle_orders")
      .select(
        "id, raffle_id, buyer_name, buyer_phone, numbers, total_cents, status, expires_at, paid_at, created_at, pix_copy_paste, pix_qr_base64"
      )
      .eq("id", input.orderId)
      .maybeSingle();

    if (orderError) {
      console.error("submitRafflePaymentProof order", orderError);
      return {
        ok: false,
        message: orderError.message || "Não foi possível localizar o pedido.",
      };
    }
    if (!orderRow) {
      return { ok: false, message: "Pedido não encontrado." };
    }

    const { data: raffle, error: raffleError } = await admin
      .from("raffles")
      .select("id, title, public_token")
      .eq("id", orderRow.raffle_id)
      .maybeSingle();

    if (raffleError) {
      console.error("submitRafflePaymentProof raffle", raffleError);
      return {
        ok: false,
        message: raffleError.message || "Não foi possível localizar a rifa.",
      };
    }
    if (!raffle?.public_token || raffle.public_token !== token) {
      return { ok: false, message: "Pedido não pertence a esta rifa." };
    }

    const orderPhone = normalizePhone(String(orderRow.buyer_phone ?? ""));
    const clientPhone = normalizePhone(input.buyerPhone);
    const phone = clientPhone || orderPhone;
    if (!phone) {
      return { ok: false, message: "Informe o WhatsApp usado na compra." };
    }
    if (clientPhone && clientPhone !== orderPhone) {
      return {
        ok: false,
        message: "Este pedido não pertence a este WhatsApp.",
      };
    }

    const { data, error } = await admin.rpc("attach_raffle_order_payment_proof", {
      p_token: token,
      p_order_id: input.orderId,
      p_phone: phone,
      p_payment_proof_url: url,
    });

    if (error) {
      console.error("attach_raffle_order_payment_proof", error);
      return {
        ok: false,
        message: error.message || "Não foi possível enviar o comprovante.",
      };
    }

    const payload = data as { ok?: boolean; status?: string } | null;
    if (!payload?.ok) {
      return { ok: false, message: "Não foi possível enviar o comprovante." };
    }

    try {
      const pushed = await notifyStaffRafflePaymentProof({
        orderId: input.orderId,
        phone: orderPhone || phone,
        raffleId: String(raffle.id ?? orderRow.raffle_id ?? ""),
        raffleTitle: String(raffle.title ?? ""),
      });
      if (pushed < 1) {
        console.warn("Comprovante salvo, mas nenhum push Expo foi enviado.");
      }
    } catch (pushError) {
      console.error("notifyStaffRafflePaymentProof", pushError);
    }

    return {
      ok: true,
      order: {
        id: String(orderRow.id),
        status: "pending_review",
        numbers: Array.isArray(orderRow.numbers)
          ? (orderRow.numbers as number[])
          : [],
        totalCents: Number(orderRow.total_cents ?? 0),
        pixCopyPaste: String(orderRow.pix_copy_paste ?? ""),
        pixQrBase64: String(orderRow.pix_qr_base64 ?? ""),
        paymentProofUrl: url,
        expiresAt:
          orderRow.expires_at == null ? null : String(orderRow.expires_at),
        paidAt: orderRow.paid_at == null ? null : String(orderRow.paid_at),
        createdAt:
          orderRow.created_at == null ? null : String(orderRow.created_at),
        buyerPhone: orderPhone || phone,
        buyerName: String(orderRow.buyer_name ?? ""),
      },
      message: "Comprovante enviado com sucesso.",
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
