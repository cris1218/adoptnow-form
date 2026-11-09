"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  lookupRaffleOrdersByPhone,
  purchaseRaffleNumbers,
  submitRafflePaymentProof,
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
  if (status === "pending_review") return "Em análise";
  if (status === "awaiting_payment") return "Aguardando Pix";
  if (status === "rejected") return "Rejeitado";
  return "Expirado";
}

function orderStatusBadgeClass(status: BuyerOrder["status"]): string {
  if (status === "paid") return "bg-emerald-100 text-emerald-900";
  if (status === "pending_review") return "bg-amber-100 text-amber-900";
  if (status === "awaiting_payment") return "bg-sky-100 text-sky-900";
  if (status === "rejected") return "bg-rose-100 text-rose-900";
  return "bg-stone-100 text-stone-700";
}

async function uploadProof(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  let extension = "jpg";
  if (name.endsWith(".png") || type === "image/png") extension = "png";
  else if (name.endsWith(".webp") || type === "image/webp") extension = "webp";
  else if (name.endsWith(".heic") || type === "image/heic" || type === "image/heif") {
    extension = "heic";
  } else if (name.endsWith(".pdf") || type === "application/pdf") {
    extension = "pdf";
  }

  const contentType =
    file.type ||
    (extension === "pdf"
      ? "application/pdf"
      : extension === "heic"
        ? "image/heic"
        : "image/jpeg");

  const presignResponse = await fetch("/api/document-presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      extension,
      contentType,
      size: file.size,
    }),
  });
  const presign = (await presignResponse.json()) as {
    uploadUrl?: string;
    publicUrl?: string;
    headers?: Record<string, string>;
    error?: string;
  };
  if (!presignResponse.ok || !presign.uploadUrl || !presign.publicUrl) {
    throw new Error(presign.error ?? "Falha ao preparar o envio.");
  }

  const uploadResponse = await fetch(presign.uploadUrl, {
    method: "PUT",
    headers: presign.headers ?? { "Content-Type": contentType },
    body: file,
  });
  if (!uploadResponse.ok) {
    throw new Error("Falha ao enviar o comprovante.");
  }
  return presign.publicUrl;
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
  const [proofSentSuccess, setProofSentSuccess] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const proofInputRef = useRef<HTMLInputElement>(null);
  const pixSectionRef = useRef<HTMLDivElement>(null);
  const pixCopyPasteRef = useRef<HTMLTextAreaElement>(null);
  const lookupSectionRef = useRef<HTMLDivElement>(null);

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
    if (!activeOrder) return;
    setPixCopied(false);
    setProofFile(null);
    setProofUploading(false);
    const frame = window.requestAnimationFrame(() => {
      pixSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeOrder?.id]);

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
        const selected = document.execCommand("copy");
        if (!selected) {
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
    setOrdersModalOpen(false);
    startTransition(async () => {
      const result = await lookupRaffleOrdersByPhone(token, lookupPhone);
      if (!result.ok) {
        setOrders([]);
        showAlert(
          "Consulta indisponível",
          result.message || "Não foi possível buscar os números agora.",
          "error"
        );
        return;
      }
      setOrders(result.orders);
      if (result.orders.length === 0) {
        showAlert(
          "Nenhum número encontrado",
          "Nenhum número comprado para esse celular.",
          "error"
        );
        return;
      }
      setOrdersModalOpen(true);
    });
  }

  function canOpenOrderFromModal(order: BuyerOrder) {
    return (
      order.status === "awaiting_payment" || order.status === "pending_review"
    );
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
          result.message || "Não foi possível gerar o Pix.",
          "error"
        );
        window.location.reload();
        return;
      }
      setActiveOrder(result.order);
      setSelected([]);
      setNumbers((current) =>
        current.map((item) =>
          result.order!.numbers.includes(item.number)
            ? { ...item, status: "reserved" }
            : item
        )
      );
      showAlert(
        "Pix gerado",
        "Pague em até 30 minutos e anexe o comprovante.",
        "success"
      );
    });
  }

  function handleProofFilePicked(file: File | null) {
    if (!file) return;
    setProofFile(file);
  }

  function handleSendProof() {
    if (!proofFile || !activeOrder) return;
    setProofUploading(true);
    const orderId = activeOrder.id;
    const phoneForProof =
      activeOrder.buyerPhone || buyerPhone || lookupPhone;
    const file = proofFile;
    startTransition(async () => {
      try {
        const url = await uploadProof(file);
        const result = await submitRafflePaymentProof({
          token,
          orderId,
          buyerPhone: phoneForProof,
          paymentProofUrl: url,
        });
        if (!result.ok) {
          const failMessage =
            result.message || "Falha ao enviar comprovante.";
          setProofUploading(false);
          showAlert("Envio não concluído", failMessage, "error");
          return;
        }
        const successPhone = phoneForProof;
        setActiveOrder(null);
        setSelected([]);
        setProofFile(null);
        setProofUploading(false);
        setProofSentSuccess(true);
        if (successPhone) {
          setLookupPhone(maskPhone(successPhone));
        }
        showAlert(
          "Comprovante anexado",
          "Comprovante anexado com sucesso. Busque pelo WhatsApp para ver seus números.",
          "success"
        );
        window.setTimeout(() => {
          lookupSectionRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
          });
        }, 150);
      } catch (error) {
        const failMessage =
          error instanceof Error
            ? error.message
            : "Falha ao enviar comprovante.";
        setProofUploading(false);
        showAlert("Envio não concluído", failMessage, "error");
      } finally {
        if (proofInputRef.current) {
          proofInputRef.current.value = "";
        }
      }
    });
  }

  const showPix =
    Boolean(activeOrder) &&
    activeOrder?.status === "awaiting_payment" &&
    Boolean(activeOrder.pixCopyPaste) &&
    !proofFile &&
    !proofUploading &&
    !proofSentSuccess;

  return (
    <div className="flex flex-col gap-5">
      {raffle.photoUrls.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {raffle.photoUrls.map((url) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={url}
              src={url}
              alt=""
              className="h-40 w-40 shrink-0 rounded-2xl object-cover"
            />
          ))}
        </div>
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
          <p className="mt-2 text-sm text-emerald-800">
            Sorteado foi o número {raffle.drawnNumber}.
          </p>
        ) : null}
      </div>

      <div
        ref={lookupSectionRef}
        className="scroll-mt-4 rounded-[1.75rem] border border-white/70 bg-white/90 p-5"
      >
        <h2 className="text-lg font-semibold text-stone-900">
          Já comprou? Consulte pelo WhatsApp
        </h2>
        {proofSentSuccess ? (
          <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900">
            Comprovante anexado com sucesso. Busque pelo WhatsApp para ver seus
            números.
          </p>
        ) : null}
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-brand-950/45 p-3 sm:items-center sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raffle-orders-title"
          onClick={() => setOrdersModalOpen(false)}
        >
          <div
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-brand-bg shadow-[0_24px_60px_rgba(14,90,88,0.28)]"
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
                          Toque para ver o Pix e anexar o comprovante
                        </p>
                      ) : null}
                      {order.status === "pending_review" ? (
                        <p className="mt-3 text-xs font-medium text-amber-800">
                          Toque para ver o status da análise
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
            {pending ? "Gerando Pix..." : "Gerar Pix"}
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {raffle.status === "closed"
            ? `Vendas encerradas${drawAtLabel ? `. Sorteio em ${drawAtLabel}` : "."}`
            : "Esta rifa não está aberta para novas compras."}
        </p>
      )}

      {activeOrder ? (
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

          {showPix ? (
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
                  className="mt-2 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white shadow-sm transition hover:bg-brand-950 active:scale-[0.99]"
                  onClick={() => void handleCopyPix()}
                >
                  {pixCopied ? "Pix copiado!" : "Copiar Pix"}
                </button>
              </div>
            </>
          ) : null}

          {activeOrder.status === "awaiting_payment" ? (
            <div className="mt-4">
              <input
                ref={proofInputRef}
                type="file"
                accept="image/*,application/pdf,.heic,.heif"
                className="hidden"
                onChange={(event) =>
                  handleProofFilePicked(event.target.files?.[0] ?? null)
                }
              />
              {proofFile ? (
                <div className="mb-3 rounded-xl border border-brand-200 bg-brand-50 px-3 py-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                    Arquivo anexado
                  </p>
                  <p className="mt-1 break-all text-sm font-semibold text-stone-900">
                    {proofFile.name}
                  </p>
                  <button
                    type="button"
                    disabled={pending || proofUploading}
                    onClick={() => {
                      setProofFile(null);
                      if (proofInputRef.current) {
                        proofInputRef.current.value = "";
                      }
                    }}
                    className="mt-2 text-sm font-medium text-brand-dark transition hover:text-brand-950 disabled:opacity-50"
                  >
                    Trocar arquivo
                  </button>
                </div>
              ) : null}
              <button
                type="button"
                disabled={pending || proofUploading}
                onClick={() => {
                  if (proofFile) {
                    handleSendProof();
                    return;
                  }
                  proofInputRef.current?.click();
                }}
                className="flex h-14 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition hover:bg-brand-950 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {pending || proofUploading
                  ? "Enviando..."
                  : proofFile
                    ? "Enviar"
                    : "Anexar comprovante"}
              </button>
              <p className="mt-2 text-center text-xs text-stone-500">
                Depois do envio, a equipe confirma o pagamento no app.
              </p>
            </div>
          ) : null}

          {activeOrder.status === "pending_review" ? (
            <p className="mt-4 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Comprovante recebido. Aguarde a confirmação.
              {activeOrder.paymentProofUrl ? " Você já pode fechar esta tela." : ""}
            </p>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-xs text-stone-400">
        A reserva dos números vale por 30 minutos até anexar o comprovante.
      </p>

      <SiteAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
