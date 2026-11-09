import { NextRequest, NextResponse } from "next/server";

import { isEvolutionConfigured, sendWhatsAppText } from "@/lib/evolution";
import {
  fetchMercadoPagoPayment,
  verifyMercadoPagoWebhookSignature,
} from "@/lib/mercadopago";
import { notifyStaffRafflePaid } from "@/lib/notifyStaff";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  raffle_id: string;
  buyer_name: string;
  buyer_phone: string;
  numbers: number[] | null;
  total_cents: number;
  raffles: { title: string | null } | { title: string | null }[] | null;
};

function raffleTitle(row: OrderRow): string {
  const raffles = row.raffles;
  if (Array.isArray(raffles)) return raffles[0]?.title?.trim() || "Rifa";
  return raffles?.title?.trim() || "Rifa";
}

function approvedMessage(title: string, numbers: number[]): string {
  return [
    `Pagamento confirmado na rifa "${title}".`,
    `Números: ${numbers.join(", ")}.`,
    "Boa sorte no sorteio!",
  ].join("\n");
}

async function notifyAfterPaid(orderId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return { push: false, whatsapp: false };

  const { data, error } = await admin
    .from("raffle_orders")
    .select(
      "id, raffle_id, buyer_name, buyer_phone, numbers, total_cents, raffles(title)"
    )
    .eq("id", orderId)
    .maybeSingle();

  if (error || !data) {
    console.error("notifyAfterPaid load", error?.message);
    return { push: false, whatsapp: false };
  }

  const row = data as OrderRow;
  const title = raffleTitle(row);
  const numbers = Array.isArray(row.numbers) ? row.numbers : [];
  const buyerName = row.buyer_name?.trim() || "Alguém";
  const buyerPhone = row.buyer_phone?.trim() || "";

  let push = false;
  let whatsapp = false;

  try {
    const sent = await notifyStaffRafflePaid({
      raffleId: row.raffle_id,
      orderId: row.id,
      raffleTitle: title,
      buyerName,
      numbers,
      totalCents: row.total_cents,
    });
    push = sent > 0;
  } catch (err) {
    console.error("notifyStaffRafflePaid", err);
  }

  if (buyerPhone && isEvolutionConfigured()) {
    try {
      await sendWhatsAppText({
        phone: buyerPhone,
        text: approvedMessage(title, numbers),
      });
      whatsapp = true;
    } catch (err) {
      console.error("whatsapp raffle paid", err);
    }
  }

  return { push, whatsapp };
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

    const result = data as {
      ok?: boolean;
      status?: string;
      duplicate?: boolean;
    } | null;

    let notifications = { push: false, whatsapp: false };
    if (result?.ok && result.status === "paid" && !result.duplicate) {
      notifications = await notifyAfterPaid(orderId);
    }

    return NextResponse.json({ ok: true, result, notifications });
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
  return NextResponse.json({ ok: true, service: "rifas-mercadopago-webhook" });
}
