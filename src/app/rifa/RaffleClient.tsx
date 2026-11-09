"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  getRaffleOrderPaymentStatus,
  lookupRaffleOrdersByPhone,
  purchaseRaffleNumbers,
} from "@/app/rifa/actions";
import { SiteAlert, type SiteAlertState } from "@/components/SiteAlert";
import { pixQrImageUrl } from "@/lib/pixBrCode";
import {
  formatCentsBrl,
  type BuyerOrder,
  type PublicRaffle,
  type PublicRaffleNumber,
  type RaffleNumberStatus,
} from "@/lib/raffles";
import {
  FieldError,
  fieldBorderClass,
} from "@/components/FormFields";
import {
  fullNameError,
  maskPhone,
  phoneError,
} from "@/lib/masks";

function cellClass(status: RaffleNumberStatus, selected: boolean) {
  if (selected) return "border-brand-dark bg-brand-dark text-white";
  if (status === "paid") return "border-emerald-600 bg-emerald-50 text-emerald-900";
  if (status === "reserved") return "border-amber-500 bg-amber-50 text-amber-900";
  return "border-stone-300 bg-white text-stone-900";
}

function orderStatusLabel(status: BuyerOrder["status"]): string {
  if (status === "paid") return "Pago";
  if (status === "awaiting_payment") return "Aguardando Pix";
  if (status === "rejected") return "Rejeitado";
  return "Expirado";
}

function orderStatusBadgeClass(status: BuyerOrder["status"]): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-900";
  if (status === "awaiting_payment") return "bg-sky-100 text-sky-900";
  if (status === "rejected") return "bg-rose-100 text-rose-900";
  return "bg-stone-100 text-stone-700";
}

function formatDrawAt(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseExpiresAtMs(value: string | null): number | null {
  if (!value) return null;
  const raw = value.trim().replace(" ", "T");
  if (!raw) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const ms = new Date(raw).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = new Date(`${raw}-03:00`).getTime();
  return Number.isNaN(ms) ? null : ms;
}

function formatCountdown(remainingMs: number): string {
  const totalSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function RafflePhotoCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const count = urls.length;

  useEffect(() => {
    setIndex(0);
  }, [urls]);

  useEffect(() => {
    if (count < 2) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 5000);
    return () => window.clearInterval(id);
  }, [count, urls]);

  if (count < 1) return null;

  return (
    <div className="relative overflow-hidden rounded-[1.75rem] border border-white/70 bg-stone-100 shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
      <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
        {urls.map((url, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={url}
            src={url}
            alt=""
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}
      </div>
      {count > 1 ? (
        <div className="absolute inset-x-0 bottom-3 flex items-center justify-center gap-1.5">
          {urls.map((url, i) => (
            <button
              key={url}
              type="button"
              aria-label={`Foto ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === index
                  ? "w-5 bg-white shadow"
                  : "w-2 bg-white/60 hover:bg-white/90"
              }`}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

async function copyTextToClipboard(value: string): Promise<boolean> {
  const text = value.trim();
  if (!text) return false;

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback abaixo
  }

  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.width = "1px";
  area.style.height = "1px";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.focus();
  area.select();
  area.setSelectionRange(0, text.length);
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(area);
  return ok;
}

export function RaffleClient({
  token,
  initialRaffle,
  initialNumbers,
}: {
  token: string;
  initialRaffle: PublicRaffle;
  initialNumbers: PublicRaffleNumber[];
}) {
  const [raffle] = useState(initialRaffle);
  const [numbers, setNumbers] = useState(initialNumbers);
  const [selected, setSelected] = useState<number[]>([]);
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [buyerNameTouched, setBuyerNameTouched] = useState(false);
  const [buyerPhoneTouched, setBuyerPhoneTouched] = useState(false);
  const [lookupPhone, setLookupPhone] = useState("");
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [ordersModalOpen, setOrdersModalOpen] = useState(false);
  const [activeOrder, setActiveOrder] = useState<BuyerOrder | null>(null);
  const [alert, setAlert] = useState<SiteAlertState>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [pending, startTransition] = useTransition();
  const pixSectionRef = useRef<HTMLDivElement>(null);
  const pixCopyPasteRef = useRef<HTMLTextAreaElement>(null);
  const lookupSectionRef = useRef<HTMLDivElement>(null);
  const expiredHandledRef = useRef<string | null>(null);
  const paidHandledRef = useRef<string | null>(null);

  const canBuy = raffle.status === "open";
  const totalCents = selected.length * raffle.priceCents;
  const drawAtLabel = formatDrawAt(raffle.drawAt);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const buyerNameError = fullNameError(buyerName);
  const buyerPhoneError = phoneError(buyerPhone);

  function showAlert(
    title: string,
    message: string,
    tone: NonNullable<SiteAlertState>["tone"] = "info"
  ) {
    setAlert({ title, message, tone });
  }

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "awaiting_payment") return;
    setPixCopied(false);
    const frame = window.requestAnimationFrame(() => {
      pixSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeOrder?.id, activeOrder?.status]);

  useEffect(() => {
    if (!activeOrder?.expiresAt || activeOrder.status !== "awaiting_payment") {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const end = parseExpiresAtMs(activeOrder.expiresAt);
      if (end == null) {
        setRemainingMs(0);
        return;
      }
      setRemainingMs(Math.max(0, end - Date.now()));
    };

    tick();
    const id = window.setInterval(tick, 250);
    return () => window.clearInterval(id);
  }, [activeOrder?.id, activeOrder?.expiresAt, activeOrder?.status]);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "awaiting_payment") return;
    const end = parseExpiresAtMs(activeOrder.expiresAt);
    // Evita falso "tempo esgotado" enquanto remainingMs ainda é 0 no mount.
    if (end == null || Date.now() < end) return;
    if (expiredHandledRef.current === activeOrder.id) return;
    expiredHandledRef.current = activeOrder.id;

    showAlert(
      "Tempo esgotado",
      "Os números voltaram a ficar livres. Escolha de novo e gere outro Pix.",
      "error"
    );
    setActiveOrder(null);
    window.setTimeout(() => window.location.reload(), 900);
  }, [remainingMs, activeOrder?.id, activeOrder?.status, activeOrder?.expiresAt]);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "awaiting_payment") return;

    let cancelled = false;
    const poll = async () => {
      const result = await getRaffleOrderPaymentStatus({
        token,
        orderId: activeOrder.id,
      });
      if (cancelled || !result.ok || !result.order) return;

      if (result.order.status === "paid") {
        if (paidHandledRef.current === activeOrder.id) return;
        paidHandledRef.current = activeOrder.id;
        const paidPhone =
          result.order.buyerPhone?.trim() ||
          activeOrder.buyerPhone?.trim() ||
          buyerPhone;
        setNumbers((current) =>
          current.map((item) =>
            result.order!.numbers.includes(item.number)
              ? { ...item, status: "paid" }
              : item
          )
        );
        setActiveOrder(null);
        setPaymentConfirmed(true);
        if (paidPhone) setLookupPhone(maskPhone(paidPhone));
        showAlert(
          "Pagamento confirmado",
          "Seus números estão garantidos. Boa sorte no sorteio!",
          "success"
        );
        window.requestAnimationFrame(() => {
          lookupSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        });
        return;
      }

      if (
        result.order.status === "expired" ||
        result.order.status === "rejected"
      ) {
        if (expiredHandledRef.current === activeOrder.id) return;
        expiredHandledRef.current = activeOrder.id;
        showAlert(
          "Pedido encerrado",
          "Os números voltaram a ficar livres.",
          "error"
        );
        setActiveOrder(null);
        window.setTimeout(() => window.location.reload(), 900);
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeOrder?.id, activeOrder?.status, token]);

  async function handleCopyPix() {
    const value = activeOrder?.pixCopyPaste ?? "";
    const area = pixCopyPasteRef.current;
    if (area) {
      area.focus();
      area.select();
      area.setSelectionRange(0, value.length);
    }
    const ok = await copyTextToClipboard(value);
    if (!ok && area) {
      try {
        const selectedText = document.execCommand("copy");
        if (!selectedText) {
          showAlert(
            "Não foi possível copiar",
            "Selecione o texto e copie manualmente.",
            "error"
          );
          return;
        }
      } catch {
        showAlert(
          "Não foi possível copiar",
          "Selecione o texto e copie manualmente.",
          "error"
        );
        return;
      }
    }
    setPixCopied(true);
    showAlert("Pix copiado", "Cole no app do seu banco.", "success");
    window.setTimeout(() => setPixCopied(false), 2500);
  }

  function toggleNumber(n: PublicRaffleNumber) {
    if (!canBuy || n.status !== "available") return;
    setSelected((current) =>
      current.includes(n.number)
        ? current.filter((item) => item !== n.number)
        : [...current, n.number].sort((a, b) => a - b)
    );
  }

  function handleLookup() {
    startTransition(async () => {
      const result = await lookupRaffleOrdersByPhone(token, lookupPhone);
      if (!result.ok) {
        showAlert(
          "Consulta",
          result.message || "Falha ao buscar pedidos.",
          "error"
        );
        return;
      }
      if (result.orders.length === 0) {
        showAlert(
          "Nada encontrado",
          "Não achamos compra com este WhatsApp nesta rifa.",
          "info"
        );
        return;
      }
      setOrders(result.orders);
      setOrdersModalOpen(true);
    });
  }

  function canOpenOrderFromModal(order: BuyerOrder) {
    return order.status === "awaiting_payment";
  }

  function openOrderFromModal(order: BuyerOrder) {
    if (!canOpenOrderFromModal(order)) return;
    setOrdersModalOpen(false);
    const phone = order.buyerPhone || lookupPhone;
    setActiveOrder({ ...order, buyerPhone: phone });
    if (!buyerPhone && phone) setBuyerPhone(phone);
    if (!buyerName && order.buyerName) setBuyerName(order.buyerName);
  }

  function handlePurchase() {
    setBuyerNameTouched(true);
    setBuyerPhoneTouched(true);
    if (buyerNameError || buyerPhoneError) {
      showAlert(
        "Dados incompletos",
        buyerNameError || buyerPhoneError || "Confira nome e WhatsApp.",
        "error"
      );
      return;
    }
    startTransition(async () => {
      const result = await purchaseRaffleNumbers({
        token,
        numbers: selected,
        buyerName,
        buyerPhone,
      });
      if (!result.ok || !result.order) {
        showAlert(
          "Falha na compra",
          result.message || "Não foi possível iniciar o pagamento.",
          "error"
        );
        return;
      }
      setActiveOrder(result.order);
      setSelected([]);
      setBuyerName("");
      setBuyerPhone("");
      setBuyerNameTouched(false);
      setBuyerPhoneTouched(false);
      setNumbers((current) =>
        current.map((item) =>
          result.order!.numbers.includes(item.number)
            ? { ...item, status: "reserved" }
            : item
        )
      );
      showAlert(
        "Pedido reservado",
        "Pague em até 5 minutos. A confirmação é automática.",
        "success"
      );
    });
  }

  const showPix =
    Boolean(activeOrder) &&
    activeOrder?.status === "awaiting_payment" &&
    Boolean(activeOrder.pixCopyPaste || activeOrder.pixTicketUrl);

  return (
    <div className="flex flex-col gap-5">
      {raffle.photoUrls.length > 0 ? (
        <RafflePhotoCarousel urls={raffle.photoUrls} />
      ) : null}

      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {raffle.title}
        </h1>
        {raffle.itemsDescription ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-stone-600">
            {raffle.itemsDescription.trimEnd()}
          </p>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-brand-dark">
          {formatCentsBrl(raffle.priceCents)} por número
          {raffle.status === "drawn"
            ? ` · Sorteada${raffle.drawnNumber != null ? ` (#${raffle.drawnNumber})` : ""}`
            : raffle.status === "closed"
              ? " · Encerrada"
              : ""}
        </p>
        {raffle.status === "closed" && drawAtLabel ? (
          <p className="mt-2 text-sm text-amber-900">
            Vendas encerradas. Sorteio em {drawAtLabel}.
          </p>
        ) : null}
        {raffle.status === "drawn" ? (
          <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">
              Sorteado foi o número {raffle.drawnNumber}.
            </p>
            {raffle.winnerName ? (
              <p className="mt-1 text-sm text-emerald-900">
                Ganhador: {raffle.winnerName}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div
        ref={lookupSectionRef}
        className="scroll-mt-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5"
      >
        {paymentConfirmed ? (
          <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-sm font-semibold text-emerald-900">
              Pagamento confirmado. Boa sorte no sorteio!
            </p>
            <p className="mt-1 text-sm text-emerald-800">
              Para ver seus números, busque pelo WhatsApp abaixo.
            </p>
          </div>
        ) : null}
        <h2 className="text-lg font-semibold text-stone-900">
          Já comprou? Consulte pelo WhatsApp
        </h2>
        <label className="mt-3 block text-sm font-medium text-stone-700">
          WhatsApp
          <input
            className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3"
            value={lookupPhone}
            onChange={(event) => setLookupPhone(maskPhone(event.target.value))}
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="(42) 99999-9999"
          />
        </label>
        <button
          type="button"
          disabled={pending || lookupPhone.trim().length === 0}
          onClick={handleLookup}
          className="mt-3 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-stone-200 text-base font-semibold text-stone-900 shadow-sm transition hover:bg-stone-300 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Buscar meus números
        </button>
      </div>

      {ordersModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/45 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raffle-orders-title"
          onClick={() => setOrdersModalOpen(false)}
        >
          <div
            className="flex max-h-[90dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-[1.75rem] border border-white/70 bg-brand-bg shadow-[0_24px_60px_rgba(14,90,88,0.28)] sm:max-h-[85dvh] sm:rounded-[1.75rem]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 bg-brand-dark px-5 py-4 text-white">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                  Consulta
                </p>
                <h2
                  id="raffle-orders-title"
                  className="mt-1 text-xl font-bold tracking-tight"
                >
                  Seus números
                </h2>
                <p className="mt-1 truncate text-sm text-white/85">
                  {lookupPhone}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white/15 text-xl leading-none transition hover:bg-white/25"
                onClick={() => setOrdersModalOpen(false)}
              >
                ×
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <ul className="space-y-3">
                {orders.map((order) => {
                  const actionable = canOpenOrderFromModal(order);
                  const cardClass =
                    "w-full rounded-[1.35rem] border border-white/80 bg-white/95 px-4 py-4 text-left shadow-[0_10px_28px_rgba(14,90,88,0.08)]";
                  const content = (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-base font-bold text-stone-900">
                            {order.buyerName || "Comprador"}
                          </p>
                          <p className="mt-0.5 text-sm text-stone-500">
                            {formatCentsBrl(order.totalCents)}
                          </p>
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${orderStatusBadgeClass(order.status)}`}
                        >
                          {orderStatusLabel(order.status)}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {order.numbers.map((number) => (
                          <span
                            key={`${order.id}-${number}`}
                            className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-brand-dark px-2 text-sm font-semibold text-white"
                          >
                            {number}
                          </span>
                        ))}
                      </div>
                      {order.status === "awaiting_payment" ? (
                        <p className="mt-3 text-xs font-medium text-brand-dark">
                          Toque para ver o Pix e o tempo restante
                        </p>
                      ) : null}
                    </>
                  );

                  return (
                    <li key={order.id}>
                      {actionable ? (
                        <button
                          type="button"
                          className={`${cardClass} cursor-pointer transition hover:border-brand-light/50 hover:shadow-[0_14px_32px_rgba(14,90,88,0.14)] active:scale-[0.99]`}
                          onClick={() => openOrderFromModal(order)}
                        >
                          {content}
                        </button>
                      ) : (
                        <div className={cardClass}>{content}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="border-t border-stone-200/80 bg-white/80 px-4 py-3">
              <button
                type="button"
                className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-stone-200 text-base font-semibold text-stone-900 transition hover:bg-stone-300 active:scale-[0.99]"
                onClick={() => setOrdersModalOpen(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5">
        <h2 className="text-lg font-semibold text-stone-900">Números</h2>
        <p className="mt-1 text-sm text-stone-500">
          Verde = pago · Amarelo = reservado · Branco = livre
        </p>
        <div className="mt-4 grid w-full grid-cols-5 gap-1.5 sm:grid-cols-8 sm:gap-2 md:grid-cols-10">
          {numbers.map((item) => {
            const selectedNow = selectedSet.has(item.number);
            const disabled = !canBuy || item.status !== "available";
            return (
              <button
                key={item.number}
                type="button"
                disabled={disabled && !selectedNow}
                onClick={() => toggleNumber(item)}
                className={`flex aspect-square w-full cursor-pointer items-center justify-center rounded-lg border text-xs font-semibold transition hover:border-brand-dark hover:shadow-sm active:scale-[0.97] disabled:cursor-default disabled:opacity-70 sm:text-sm ${cellClass(item.status, selectedNow)}`}
              >
                {item.number}
              </button>
            );
          })}
        </div>
      </div>

      {canBuy ? (
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5">
          <h2 className="text-lg font-semibold text-stone-900">Comprar</h2>
          <p className="mt-1 text-sm text-stone-600">
            Selecionados: {selected.length || "nenhum"}
            {selected.length ? ` · Total ${formatCentsBrl(totalCents)}` : ""}
          </p>
          <label className="mt-3 block text-sm font-medium text-stone-700">
            Nome completo
            <input
              className={`mt-1 w-full rounded-xl border px-3 py-3 ${fieldBorderClass(
                buyerNameTouched && Boolean(buyerNameError)
              )}`}
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              onBlur={() => setBuyerNameTouched(true)}
              autoComplete="name"
              autoCapitalize="words"
              placeholder="Nome e sobrenome"
            />
          </label>
          <FieldError
            id="buyer-name-error"
            message={buyerNameTouched ? buyerNameError : ""}
          />
          <label className="mt-3 block text-sm font-medium text-stone-700">
            WhatsApp
            <input
              className={`mt-1 w-full rounded-xl border px-3 py-3 ${fieldBorderClass(
                buyerPhoneTouched && Boolean(buyerPhoneError)
              )}`}
              value={buyerPhone}
              onChange={(event) => setBuyerPhone(maskPhone(event.target.value))}
              onBlur={() => setBuyerPhoneTouched(true)}
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="(42) 99999-9999"
            />
          </label>
          <FieldError
            id="buyer-phone-error"
            message={buyerPhoneTouched ? buyerPhoneError : ""}
          />
          <button
            type="button"
            disabled={
              pending ||
              selected.length === 0 ||
              Boolean(buyerNameError) ||
              Boolean(buyerPhoneError)
            }
            onClick={handlePurchase}
            className="mt-4 flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition hover:bg-brand-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Preparando pagamento..." : "Pagar"}
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {raffle.status === "closed"
            ? `Vendas encerradas${drawAtLabel ? `. Sorteio em ${drawAtLabel}` : "."}`
            : "Esta rifa não está aberta para novas compras."}
        </p>
      )}

      {activeOrder?.status === "awaiting_payment" ? (
        <div
          ref={pixSectionRef}
          className="scroll-mt-4 rounded-[1.75rem] border border-brand-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-stone-900">
            {orderStatusLabel(activeOrder.status)}
          </h2>
          {activeOrder.buyerName ? (
            <p className="mt-1 text-sm font-medium text-stone-800">
              {activeOrder.buyerName}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-stone-600">
            Números {activeOrder.numbers.join(", ")} ·{" "}
            {formatCentsBrl(activeOrder.totalCents)}
          </p>

          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">
              Tempo para pagar
            </p>
            <p className="mt-1 text-3xl font-bold tabular-nums text-amber-950">
              {formatCountdown(remainingMs)}
            </p>
            <p className="mt-1 text-xs text-amber-800">
              Sem pagamento, os números voltam a ficar livres.
            </p>
          </div>

          {showPix ? (
            <>
              {activeOrder.pixTicketUrl ? (
                <a
                  href={activeOrder.pixTicketUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition hover:bg-brand-950 active:scale-[0.99]"
                >
                  Pagar
                </a>
              ) : null}
              {activeOrder.pixCopyPaste || activeOrder.pixQrBase64 ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={
                      activeOrder.pixQrBase64
                        ? `data:image/png;base64,${activeOrder.pixQrBase64}`
                        : pixQrImageUrl(activeOrder.pixCopyPaste)
                    }
                    alt="QR Code Pix"
                    className="mx-auto mt-4 h-56 w-56 rounded-xl border border-stone-200 bg-white"
                  />
                  {activeOrder.pixCopyPaste ? (
                    <div className="mt-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                        Copia e cola
                      </p>
                      <textarea
                        ref={pixCopyPasteRef}
                        readOnly
                        className="mt-1 h-28 w-full rounded-xl border border-stone-300 p-3 text-xs"
                        value={activeOrder.pixCopyPaste}
                        onFocus={(event) => event.currentTarget.select()}
                      />
                      <button
                        type="button"
                        className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl border border-brand-dark bg-white text-base font-semibold text-brand-dark shadow-sm transition hover:bg-brand-50 active:scale-[0.99]"
                        onClick={() => void handleCopyPix()}
                      >
                        {pixCopied ? "Pix copiado!" : "Copiar Pix"}
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
              <p className="mt-3 text-center text-xs text-stone-500">
                Pagou? A confirmação é automática. Pode deixar esta tela aberta.
              </p>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-xs text-stone-400">
        A reserva dos números vale por 5 minutos até o Pix ser pago.
      </p>

      <SiteAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
