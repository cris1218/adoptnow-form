import { NextRequest, NextResponse } from "next/server";

import {
  fetchMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercadopago";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      data?: { id?: string | number };
      type?: string;
      action?: string;
    };

    const dataId = String(body.data?.id ?? "").trim();
    if (!dataId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const valid = await verifyMercadoPagoWebhookSignature({
      xSignature: request.headers.get("x-signature"),
      xRequestId: request.headers.get("x-request-id"),
      dataId,
    });
    if (!valid) {
      return NextResponse.json({ ok: false, message: "Assinatura inválida" }, { status: 401 });
    }

    const payment = await fetchMercadoPagoPayment(dataId);
    if (payment.status !== "approved") {
      return NextResponse.json({ ok: true, status: payment.status });
    }

    const orderId = payment.externalReference.trim();
    if (!orderId) {
      return NextResponse.json({ ok: false, message: "Sem referência" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json(
        { ok: false, message: "Admin ausente" },
        { status: 500 }
      );
    }

    const { data, error } = await admin.rpc("mark_raffle_order_paid", {
      p_order_id: orderId,
      p_mp_payment_id: payment.id,
      p_amount_cents: payment.transactionAmountCents,
    });

    if (error) {
      console.error("mark_raffle_order_paid", error);
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("rifas webhook", error);
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
  return NextResponse.json({ ok: true });
}
