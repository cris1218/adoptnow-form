"use server";

import {
  createCardPayment,
  createPixPayment,
  formatCardRejectionMessage,
} from "@/lib/mercadopago";
import {
  fullNameError,
  normalizeFullName,
  normalizePhone,
  phoneError,
} from "@/lib/masks";
import { consumeActionRateLimit } from "@/lib/actionRateLimit";
import { notifyStaffVaquinhaPaid } from "@/lib/notifyStaff";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getSupabaseServer } from "@/lib/supabase";
import {
  cardChargeCentsFromDonation,
  mapPaymentMethod,
  mapPublicVaquinha,
  type DonationOrder,
  type PublicVaquinha,
  type VaquinhaPaymentMethod,
} from "@/lib/vaquinhas";

function vaquinhaWebhookUrl() {
  return `${
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://recantoronron.com.br"
  }/api/vaquinhas/webhook`;
}

function adminOrThrow() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return admin;
}

function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

export async function loadVaquinhaPublic(token: string): Promise<{
  ok: boolean;
  message?: string;
  vaquinha?: PublicVaquinha;
}> {
  const supabase = getSupabaseServer();
  const { data, error } = await supabase.rpc("get_vaquinha_public", {
    p_token: token.trim(),
  });
  if (error) {
    console.error("get_vaquinha_public", error);
    return { ok: false, message: "Não foi possível carregar a vaquinha." };
  }
  const payload = data as {
    ok?: boolean;
    message?: string;
    vaquinha?: Record<string, unknown>;
  } | null;
  if (!payload?.ok || !payload.vaquinha) {
    return {
      ok: false,
      message: payload?.message || "Vaquinha não encontrada.",
    };
  }
  return {
    ok: true,
    vaquinha: mapPublicVaquinha(payload.vaquinha),
  };
}

export async function createVaquinhaDonation(input: {
  token: string;
  amountText: string;
  isAnonymous: boolean;
  donorName: string;
  donorPhone: string;
}): Promise<{
  ok: boolean;
  message?: string;
  order?: DonationOrder;
}> {
  const rate = await consumeActionRateLimit({
    bucket: "action:vaquinha-donate",
    limit: 15,
    windowSeconds: 600,
  });
  if (!rate.ok) {
    return { ok: false, message: rate.message };
  }

  const amountCents = parseAmountToCents(input.amountText);
  if (amountCents == null || amountCents < 500) {
    return { ok: false, message: "O valor mínimo da doação é R$ 5,00." };
  }

  let name = "";
  let phone = "";
  if (!input.isAnonymous) {
    name = normalizeFullName(input.donorName);
    const nameError = fullNameError(name);
    if (nameError) {
      return { ok: false, message: nameError };
    }
    phone = normalizePhone(input.donorPhone);
    const donorPhoneError = phoneError(phone);
    if (donorPhoneError) {
      return { ok: false, message: donorPhoneError };
    }
  }

  try {
    const admin = adminOrThrow();
    const { data, error } = await admin.rpc("create_vaquinha_order", {
      p_token: input.token.trim(),
      p_amount_cents: amountCents,
      p_is_anonymous: input.isAnonymous,
      p_donor_name: name,
      p_donor_phone: phone,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível criar a doação.",
      };
    }

    const created = data as {
      ok?: boolean;
      order_id?: string;
      vaquinha_id?: string;
      amount_cents?: number;
      expires_at?: string;
      is_anonymous?: boolean;
      donor_name?: string;
      donor_phone?: string;
      title?: string;
    } | null;

    if (!created?.ok || !created.order_id) {
      return { ok: false, message: "Não foi possível criar a doação." };
    }

    const releaseOrder = async () => {
      try {
        await admin
          .from("vaquinha_orders")
          .update({ expires_at: "1970-01-01T00:00:00" })
          .eq("id", created.order_id)
          .eq("status", "awaiting_payment");
        await admin.rpc("release_expired_vaquinha_orders", {
          p_vaquinha_id: null,
        });
      } catch (releaseError) {
        console.error("release after pix failure", releaseError);
      }
    };

    await admin
      .from("vaquinha_orders")
      .update({ payment_method: "pix" satisfies VaquinhaPaymentMethod })
      .eq("id", created.order_id);

    const title = String(created.title ?? "Vaquinha");
    let pix;
    try {
      pix = await createPixPayment({
        orderId: created.order_id,
        amountCents,
        description: `Vaquinha · ${title}`,
        productKind: "vaquinha",
        campaignId: String(created.vaquinha_id ?? ""),
        campaignTitle: title,
        buyerPhone: phone,
        expirationMinutes: 30,
        notificationUrl: vaquinhaWebhookUrl(),
      });
    } catch (pixError) {
      await releaseOrder();
      throw pixError;
    }

    const { error: attachError } = await admin.rpc("attach_vaquinha_order_pix", {
      p_order_id: created.order_id,
      p_mp_payment_id: pix.id,
      p_pix_copy_paste: pix.qrCode,
      p_pix_qr_base64: pix.qrCodeBase64,
    });

    if (attachError) {
      console.error("attach_vaquinha_order_pix", attachError);
      await releaseOrder();
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
        id: created.order_id,
        status: "awaiting_payment",
        amountCents,
        isAnonymous: Boolean(created.is_anonymous),
        donorName: String(created.donor_name ?? ""),
        donorPhone: String(created.donor_phone ?? ""),
        paymentMethod: "pix",
        pixCopyPaste: pix.qrCode,
        pixQrBase64: pix.qrCodeBase64,
        pixTicketUrl: pix.ticketUrl || undefined,
        expiresAt: created.expires_at ?? null,
        paidAt: null,
        createdAt: null,
      },
    };
  } catch (error) {
    console.error("createVaquinhaDonation", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível gerar o Pix agora.",
    };
  }
}

export async function payVaquinhaWithCard(input: {
  token: string;
  amountText: string;
  isAnonymous: boolean;
  donorName: string;
  donorPhone: string;
  cardToken: string;
  paymentMethodId: string;
  issuerId?: string | number | null;
  installments?: number;
}): Promise<{
  ok: boolean;
  message?: string;
  order?: DonationOrder;
}> {
  const rate = await consumeActionRateLimit({
    bucket: "action:vaquinha-card",
    limit: 15,
    windowSeconds: 600,
  });
  if (!rate.ok) {
    return { ok: false, message: rate.message };
  }

  const amountCents = parseAmountToCents(input.amountText);
  if (amountCents == null || amountCents < 500) {
    return { ok: false, message: "O valor mínimo da doação é R$ 5,00." };
  }

  let name = "";
  let phone = "";
  if (!input.isAnonymous) {
    name = normalizeFullName(input.donorName);
    const nameError = fullNameError(name);
    if (nameError) {
      return { ok: false, message: nameError };
    }
    phone = normalizePhone(input.donorPhone);
    const donorPhoneError = phoneError(phone);
    if (donorPhoneError) {
      return { ok: false, message: donorPhoneError };
    }
  }

  try {
    const admin = adminOrThrow();
    const { data, error } = await admin.rpc("create_vaquinha_order", {
      p_token: input.token.trim(),
      p_amount_cents: amountCents,
      p_is_anonymous: input.isAnonymous,
      p_donor_name: name,
      p_donor_phone: phone,
    });

    if (error) {
      return {
        ok: false,
        message: error.message || "Não foi possível criar a doação.",
      };
    }

    const created = data as {
      ok?: boolean;
      order_id?: string;
      expires_at?: string;
      is_anonymous?: boolean;
      donor_name?: string;
      donor_phone?: string;
      title?: string;
      vaquinha_id?: string;
    } | null;

    if (!created?.ok || !created.order_id) {
      return { ok: false, message: "Não foi possível criar a doação." };
    }

    const releaseOrder = async () => {
      try {
        await admin
          .from("vaquinha_orders")
          .update({ expires_at: "1970-01-01T00:00:00" })
          .eq("id", created.order_id)
          .eq("status", "awaiting_payment");
        await admin.rpc("release_expired_vaquinha_orders", {
          p_vaquinha_id: null,
        });
      } catch (releaseError) {
        console.error("release after card failure", releaseError);
      }
    };

    await admin
      .from("vaquinha_orders")
      .update({ payment_method: "credit_card" satisfies VaquinhaPaymentMethod })
      .eq("id", created.order_id);

    const title = String(created.title ?? "Vaquinha");
    // Pedido guarda a doação; cobramos doação + taxa MP no cartão.
    const chargeCents = cardChargeCentsFromDonation(amountCents);
    let card;
    try {
      card = await createCardPayment({
        orderId: created.order_id,
        amountCents: chargeCents,
        description: `Vaquinha · ${title}`,
        productKind: "vaquinha",
        campaignId: String(created.vaquinha_id ?? ""),
        campaignTitle: title,
        token: input.cardToken,
        paymentMethodId: input.paymentMethodId,
        installments: input.installments ?? 1,
        issuerId: input.issuerId,
        buyerPhone: phone,
        notificationUrl: vaquinhaWebhookUrl(),
      });
    } catch (cardError) {
      await releaseOrder();
      return {
        ok: false,
        message:
          cardError instanceof Error
            ? cardError.message
            : "Não foi possível cobrar o cartão.",
      };
    }

    const rejected =
      card.status === "rejected" ||
      card.status === "cancelled" ||
      card.status === "refunded";

    if (rejected) {
      await releaseOrder();
      return {
        ok: false,
        message: formatCardRejectionMessage(card.statusDetail),
      };
    }

    const { error: attachError } = await admin.rpc("attach_vaquinha_order_pix", {
      p_order_id: created.order_id,
      p_mp_payment_id: card.id,
      p_pix_copy_paste: "",
      p_pix_qr_base64: "",
    });

    if (attachError) {
      console.error("attach_vaquinha_order_pix card", attachError);
      await releaseOrder();
      return {
        ok: false,
        message:
          attachError.message ||
          "Não foi possível registrar o pagamento. Tente de novo.",
      };
    }

    let status: DonationOrder["status"] = "awaiting_payment";
    let paidAt: string | null = null;

    if (card.status === "approved") {
      const { data: markData, error: markError } = await admin.rpc(
        "mark_vaquinha_order_paid",
        {
          p_order_id: created.order_id,
          p_mp_payment_id: card.id,
          p_amount_cents: chargeCents,
        }
      );
      if (markError) {
        console.error("mark_vaquinha_order_paid card", markError);
      } else {
        const markResult = markData as {
          ok?: boolean;
          status?: string;
          duplicate?: boolean;
        } | null;
        if (markResult?.ok && markResult.status === "paid") {
          status = "paid";
          paidAt = new Date().toISOString();
          if (!markResult.duplicate) {
            try {
              await notifyStaffVaquinhaPaid({
                vaquinhaId: String(created.vaquinha_id ?? ""),
                orderId: created.order_id,
                vaquinhaTitle: title,
                isAnonymous: Boolean(created.is_anonymous),
                donorName: String(created.donor_name ?? ""),
                amountCents,
              });
            } catch (notifyError) {
              console.error("notifyStaffVaquinhaPaid card", notifyError);
            }
          }
        }
      }
    }

    return {
      ok: true,
      order: {
        id: created.order_id,
        status,
        amountCents,
        isAnonymous: Boolean(created.is_anonymous),
        donorName: String(created.donor_name ?? ""),
        donorPhone: String(created.donor_phone ?? ""),
        paymentMethod: "credit_card",
        pixCopyPaste: "",
        pixQrBase64: "",
        expiresAt: created.expires_at ?? null,
        paidAt,
        createdAt: null,
      },
      message:
        status === "paid"
          ? undefined
          : "Pagamento em análise. Aguarde a confirmação.",
    };
  } catch (error) {
    console.error("payVaquinhaWithCard", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível processar o cartão.",
    };
  }
}

export async function getVaquinhaOrderPaymentStatus(input: {
  token: string;
  orderId: string;
}): Promise<{
  ok: boolean;
  status?: DonationOrder["status"];
  message?: string;
  order?: DonationOrder;
  vaquinha?: PublicVaquinha;
}> {
  const rate = await consumeActionRateLimit({
    bucket: "action:vaquinha-status",
    limit: 60,
    windowSeconds: 600,
  });
  if (!rate.ok) {
    return { ok: false, message: rate.message };
  }

  try {
    const admin = adminOrThrow();
    await admin.rpc("release_expired_vaquinha_orders", {
      p_vaquinha_id: null,
    });

    const { data: orderRow, error } = await admin
      .from("vaquinha_orders")
      .select(
        "id, vaquinha_id, amount_cents, is_anonymous, donor_name, donor_phone, payment_method, status, expires_at, paid_at, created_at, pix_copy_paste, pix_qr_base64"
      )
      .eq("id", input.orderId)
      .maybeSingle();

    if (error || !orderRow) {
      return { ok: false, message: "Pedido não encontrado." };
    }

    const { data: vaquinhaRow } = await admin
      .from("vaquinhas")
      .select("public_token")
      .eq("id", orderRow.vaquinha_id)
      .maybeSingle();

    if (
      !vaquinhaRow?.public_token ||
      vaquinhaRow.public_token !== input.token.trim()
    ) {
      return { ok: false, message: "Pedido não pertence a esta vaquinha." };
    }

    const publicResult = await loadVaquinhaPublic(input.token);

    const order: DonationOrder = {
      id: String(orderRow.id),
      status: orderRow.status as DonationOrder["status"],
      amountCents: Number(orderRow.amount_cents ?? 0),
      isAnonymous: Boolean(orderRow.is_anonymous),
      donorName: String(orderRow.donor_name ?? ""),
      donorPhone: String(orderRow.donor_phone ?? ""),
      paymentMethod: mapPaymentMethod(orderRow.payment_method),
      pixCopyPaste: String(orderRow.pix_copy_paste ?? ""),
      pixQrBase64: String(orderRow.pix_qr_base64 ?? ""),
      expiresAt:
        orderRow.expires_at == null ? null : String(orderRow.expires_at),
      paidAt: orderRow.paid_at == null ? null : String(orderRow.paid_at),
      createdAt:
        orderRow.created_at == null ? null : String(orderRow.created_at),
    };

    return {
      ok: true,
      status: order.status,
      order,
      vaquinha: publicResult.vaquinha,
    };
  } catch (error) {
    console.error("getVaquinhaOrderPaymentStatus", error);
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Falha ao consultar pedido.",
    };
  }
}
