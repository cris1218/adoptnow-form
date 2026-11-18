import { NextRequest, NextResponse } from "next/server";

import {
  fetchMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercadopago";
import { notifyStaffVaquinhaPaid } from "@/lib/notifyStaff";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  vaquinha_id: string;
  amount_cents: number;
  is_anonymous: boolean;
  donor_name: string;
};

async function notifyAfterPaid(orderId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { push: false };

  const { data, error } = await admin
    .from("vaquinha_orders")
    .select("id, vaquinha_id, amount_cents, is_anonymous, donor_name")
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("vaquinha notifyAfterPaid load", error?.message);
    return { push: false };
  }

  const row = data as OrderRow;
  const { data: vaquinhaRow } = await admin
    .from("vaquinhas")
    .select("title")
    .eq("id", row.vaquinha_id)
    .maybeSingle();
  const title = String(vaquinhaRow?.title ?? "").trim() || "Vaquinha";

  let push = false;
  try {
    const sent = await notifyStaffVaquinhaPaid({
      vaquinhaId: row.vaquinha_id,
      orderId: row.id,
      vaquinhaTitle: title,
      isAnonymous: Boolean(row.is_anonymous),
      donorName: row.donor_name ?? "",
      amountCents: row.amount_cents,
    });
    push = sent > 0;
    console.log("vaquinha notifyAfterPaid push", { orderId, sent });
  } catch (err) {
    console.error("notifyStaffVaquinhaPaid", err);
  }

  return { push };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      data?: { id?: string | number };
      type?: string;
      action?: string;
      id?: string | number;
    };

    const queryId =
      request.nextUrl.searchParams.get("data.id") ||
      request.nextUrl.searchParams.get("id") ||
      "";
    const dataId = String(body.data?.id ?? body.id ?? queryId).trim();
    if (!dataId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const valid = await verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
    if (!valid) {
      return NextResponse.json(
        { ok: false, message: "Assinatura inválida" },
        { status: 401 }
      );
    }

    const payment = await fetchMercadoPagoPayment(dataId);
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const orderId = payment.externalReference.trim();
    if (!orderId) {
      return NextResponse.json(
        { ok: false, message: "Sem referência" },
        { status: 400 }
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: "Admin ausente" },
        { status: 500 }
      );
    }

    const { data, error } = await admin.rpc("mark_vaquinha_order_paid", {
      p_order_id: orderId,
      p_mp_payment_id: payment.id,
      p_amount_cents: payment.transactionAmountCents,
    });

    if (error) {
      console.error("mark_vaquinha_order_paid", error);
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    const result = data as {
      ok?: boolean;
      status?: string;
      duplicate?: boolean;
    } | null;

    let notifications = { push: false };
    if (result?.ok && result.status === "paid" && !result.duplicate) {
      notifications = await notifyAfterPaid(orderId);
    }

    return NextResponse.json({ ok: true, result, notifications });
  } catch (error) {
    console.error("vaquinhas webhook", error);
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "Erro no webhook",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "vaquinhas-mercadopago-webhook",
  });
}
