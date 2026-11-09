"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  lookupRaffleOrdersByPhone,
  purchaseRaffleNumbers,
  submitRafflePaymentProof,
} from "@/app/rifa/actions";
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
  const [message, setMessage] = useState<string | null>(null);
  const [pixCopied, setPixCopied] = useState(false);
  const [proofSentSuccess, setProofSentSuccess] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofUploading, setProofUploading] = useState(false);
  const [pending, startTransition] = useTransition();
  const proofInputRef = useRef<HTMLInputElement>(null);
  const pixSectionRef = useRef<HTMLDivElement>(null);
  const pixCopyPasteRef = useRef<HTMLTextAreaElement>(null);

  const canBuy = raffle.status === "open";
  const totalCents = selected.length * raffle.priceCents;
  const drawAtLabel = formatDrawAt(raffle.drawAt);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const buyerNameError = fullNameError(buyerName);
  const buyerPhoneError = phoneError(buyerPhone);

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
          setMessage("Não foi possível copiar. Selecione o texto e copie manualmente.");
          return;
        }
      } catch {
        setMessage("Não foi possível copiar. Selecione o texto e copie manualmente.");
        return;
      }
    }
    setPixCopied(true);
    setMessage("Pix copiado. Cole no app do seu banco.");
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
    setMessage(null);
    setOrdersModalOpen(false);
    startTransition(async () => {
      const result = await lookupRaffleOrdersByPhone(token, lookupPhone);
      if (!result.ok) {
        setOrders([]);
        setMessage(
          result.message || "Nenhum número comprado para esse celular."
        );
        return;
      }
      setOrders(result.orders);
      if (result.orders.length === 0) {
        setMessage("Nenhum número comprado para esse celular.");
        return;
      }
      setMessage(null);
      setOrdersModalOpen(true);
    });
  }

  function openOrderFromModal(order: BuyerOrder) {
    setOrdersModalOpen(false);
    const phone = order.buyerPhone || lookupPhone;
    setActiveOrder({ ...order, buyerPhone: phone });
    if (!buyerPhone && phone) setBuyerPhone(phone);
  }

  function handlePurchase() {
    setBuyerNameTouched(true);
    setBuyerPhoneTouched(true);
    setMessage(null);
    if (buyerNameError || buyerPhoneError) {
      setMessage(buyerNameError || buyerPhoneError);
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
        setMessage(result.message || "Falha na compra.");
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
      setMessage(
        "Pix gerado. Pague em até 30 minutos e anexe o comprovante."
      );
    });
  }

  function handleProofFilePicked(file: File | null) {
    if (!file) return;
    setMessage(null);
    setProofFile(file);
  }

  function handleSendProof() {
    if (!proofFile || !activeOrder) return;
    setMessage(null);
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
          setMessage(failMessage);
          window.alert(failMessage);
          return;
        }
        setActiveOrder(null);
        setSelected([]);
        setProofFile(null);
        setProofUploading(false);
        setProofSentSuccess(true);
        setMessage(null);
        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            // navegador pode bloquear close
          }
        }, 1200);
      } catch (error) {
        const failMessage =
          error instanceof Error
            ? error.message
            : "Falha ao enviar comprovante.";
        setProofUploading(false);
        setMessage(failMessage);
        window.alert(failMessage);
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

  if (proofSentSuccess) {
    return (
      <div className="rounded-[1.75rem] border border-emerald-200 bg-emerald-50 p-6 text-center shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
        <p className="text-2xl font-bold tracking-tight text-emerald-950">
          Comprovante enviado com sucesso
        </p>
        <p className="mt-3 text-base leading-relaxed text-emerald-900">
          Recebemos seu Pix. A equipe do Recanto do Ron Ron vai confirmar e
          liberar seus números.
        </p>
        <p className="mt-4 text-sm text-emerald-800">
          Pode fechar esta página.
        </p>
      </div>
    );
  }

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

      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5">
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
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="raffle-orders-title"
          onClick={() => setOrdersModalOpen(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-3xl bg-white p-5 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="raffle-orders-title"
              className="text-xl font-bold text-stone-900"
            >
              Números deste celular
            </h2>
            <p className="mt-1 text-sm text-stone-500">{lookupPhone}</p>
            <ul className="mt-4 space-y-2">
              {orders.map((order) => (
                <li key={order.id}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:border-brand-200 hover:bg-brand-50 active:scale-[0.99]"
                    onClick={() => openOrderFromModal(order)}
                  >
                    <p className="text-sm font-semibold text-stone-900">
                      {orderStatusLabel(order.status)}
                    </p>
                    <p className="mt-1 text-sm text-stone-700">
                      Números {order.numbers.join(", ")}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {formatCentsBrl(order.totalCents)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-4 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-stone-200 text-base font-semibold text-stone-900 shadow-sm transition hover:bg-stone-300 active:scale-[0.99]"
              onClick={() => setOrdersModalOpen(false)}
            >
              Fechar
            </button>
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

      {message ? (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {message}
        </p>
      ) : null}

      {activeOrder ? (
        <div
          ref={pixSectionRef}
          className="scroll-mt-4 rounded-[1.75rem] border border-brand-200 bg-white p-5"
        >
          <h2 className="text-lg font-semibold text-stone-900">
            {orderStatusLabel(activeOrder.status)}
          </h2>
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
                      setMessage(null);
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
              {message ? (
                <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
                  {message}
                </p>
              ) : null}
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
    </div>
  );
}
