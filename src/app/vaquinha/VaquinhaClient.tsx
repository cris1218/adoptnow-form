"use client";

import dynamic from "next/dynamic";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import {
  createVaquinhaDonation,
  getVaquinhaOrderPaymentStatus,
  payVaquinhaWithCard,
} from "@/app/vaquinha/actions";
import { SiteAlert, type SiteAlertState } from "@/components/SiteAlert";
import {
  FieldError,
  fieldBorderClass,
} from "@/components/FormFields";
import { pixQrImageUrl } from "@/lib/pixBrCode";
import {
  fullNameError,
  maskPhone,
  phoneError,
} from "@/lib/masks";
import {
  cardChargeCentsFromDonation,
  cardFeeCentsFromDonation,
  formatCentsBrl,
  vaquinhaProgressPercent,
  type DonationOrder,
  type PublicVaquinha,
} from "@/lib/vaquinhas";

/** Cartão liberado: Public Key + webhook secret já estão na Vercel. */
const SHOW_CARD_PAYMENT = true;

const VaquinhaCardBrick = dynamic(
  () =>
    import("@/components/VaquinhaCardBrick").then(
      (mod) => mod.VaquinhaCardBrick
    ),
  {
    ssr: false,
    loading: () => (
      <p className="text-sm text-stone-500">Carregando cartão...</p>
    ),
  }
);

type PayMethod = "pix" | "credit_card";

function formatEndsAt(raw: string | null): string | null {
  if (!raw) return null;
  const date = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
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

function parseAmountToCents(raw: string): number | null {
  const cleaned = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!cleaned) return null;
  const value = Number(cleaned);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

function VaquinhaPhotoCarousel({ urls }: { urls: string[] }) {
  const [index, setIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const count = urls.length;
  const currentUrl = urls[index] ?? urls[0] ?? "";

  useEffect(() => {
    setIndex(0);
    setLightboxOpen(false);
  }, [urls]);

  useEffect(() => {
    if (count < 2 || lightboxOpen) return;
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 5000);
    return () => window.clearInterval(id);
  }, [count, urls, lightboxOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onClose() {
      setLightboxOpen(false);
      document.body.style.overflow = "";
    }

    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
      document.body.style.overflow = "";
    };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxOpen) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
      return;
    }
    if (dialog.open) dialog.close();
  }, [lightboxOpen]);

  if (count < 1) return null;

  return (
    <>
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.75rem] border border-white/70 bg-stone-100 shadow-[0_18px_50px_rgba(14,90,88,0.12)] sm:aspect-[16/10]">
        <button
          type="button"
          aria-label="Ampliar foto"
          className="absolute inset-0 block h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
          onClick={() => setLightboxOpen(true)}
        >
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
        </button>
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

      <dialog
        ref={dialogRef}
        aria-label="Foto da vaquinha"
        onClick={(event) => {
          if (event.target === event.currentTarget) setLightboxOpen(false);
        }}
        onCancel={() => setLightboxOpen(false)}
        className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/85 p-0 open:flex"
      >
        <div
          className="relative flex h-full w-full items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))]"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setLightboxOpen(false);
            }}
            className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold leading-none text-stone-800 shadow-lg"
            aria-label="Fechar foto"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentUrl}
            alt=""
            className="max-h-full max-w-full object-contain"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      </dialog>
    </>
  );
}

export function VaquinhaClient({
  token,
  initialVaquinha,
}: {
  token: string;
  initialVaquinha: PublicVaquinha;
}) {
  const [vaquinha, setVaquinha] = useState(initialVaquinha);
  const [amountText, setAmountText] = useState("");
  const [payMethod, setPayMethod] = useState<PayMethod>("pix");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [activeOrder, setActiveOrder] = useState<DonationOrder | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [cardProcessing, setCardProcessing] = useState(false);
  const [cardWaiting, setCardWaiting] = useState(false);
  const [cardRejectMessage, setCardRejectMessage] = useState<string | null>(
    null
  );
  const [cardBrickKey, setCardBrickKey] = useState(0);
  const [alert, setAlert] = useState<SiteAlertState>(null);
  const [pending, startTransition] = useTransition();
  const [nowMs, setNowMs] = useState(() => Date.now());

  const percent = vaquinhaProgressPercent(
    vaquinha.raisedCents,
    vaquinha.goalCents
  );
  const endsAtLabel = useMemo(
    () => formatEndsAt(vaquinha.endsAt),
    [vaquinha.endsAt]
  );
  const amountCents = parseAmountToCents(amountText);
  const cardChargeCents =
    amountCents != null && amountCents >= 500
      ? cardChargeCentsFromDonation(amountCents)
      : null;
  const cardFeeCents =
    amountCents != null && amountCents >= 500
      ? cardFeeCentsFromDonation(amountCents)
      : null;

  const nameError = !isAnonymous ? fullNameError(donorName) : null;
  const phoneErr = !isAnonymous ? phoneError(donorPhone) : null;

  const expiresMs = parseExpiresAtMs(activeOrder?.expiresAt ?? null);
  const remainingMs =
    activeOrder?.status === "awaiting_payment" &&
    activeOrder.paymentMethod === "pix" &&
    expiresMs != null
      ? expiresMs - nowMs
      : null;

  useEffect(() => {
    if (activeOrder?.status !== "awaiting_payment") return;
    if (activeOrder.paymentMethod !== "pix") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.status, activeOrder?.paymentMethod]);

  useEffect(() => {
    if (!activeOrder || activeOrder.status !== "awaiting_payment") return;

    let cancelled = false;
    const poll = async () => {
      const result = await getVaquinhaOrderPaymentStatus({
        token,
        orderId: activeOrder.id,
      });
      if (cancelled || !result.ok || !result.order) return;
      setActiveOrder(result.order);
      if (result.vaquinha) setVaquinha(result.vaquinha);
      if (result.order.status === "paid") {
        setPaymentConfirmed(true);
        setCardWaiting(false);
        setCardModalOpen(false);
        setAlert({
          title: "Doação confirmada",
          message: "Obrigado pelo apoio!",
          tone: "success",
        });
      }
    };

    const timer = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [activeOrder, token]);

  function showAlert(
    title: string,
    message: string,
    tone: NonNullable<SiteAlertState>["tone"]
  ) {
    setAlert({ title, message, tone });
  }

  function validateDonor(): boolean {
    if (!isAnonymous) {
      setNameTouched(true);
      setPhoneTouched(true);
      if (nameError || phoneErr) return false;
    }
    return true;
  }

  function handleDonatePix() {
    if (!vaquinha.acceptsDonations) {
      showAlert(
        "Vaquinha encerrada",
        "Esta campanha não está aceitando doações.",
        "error"
      );
      return;
    }
    if (!validateDonor()) return;

    startTransition(async () => {
      const result = await createVaquinhaDonation({
        token,
        amountText,
        isAnonymous,
        donorName,
        donorPhone,
      });
      if (!result.ok || !result.order) {
        showAlert(
          "Não foi possível doar",
          result.message || "Tente de novo.",
          "error"
        );
        return;
      }
      setPaymentConfirmed(false);
      setActiveOrder(result.order);
      showAlert(
        "Pix gerado",
        "Pague em até 5 minutos. A confirmação é automática.",
        "success"
      );
    });
  }

  function openCardModal() {
    if (!vaquinha.acceptsDonations) {
      showAlert(
        "Vaquinha encerrada",
        "Esta campanha não está aceitando doações.",
        "error"
      );
      return;
    }
    if (!validateDonor()) return;
    if (amountCents == null || amountCents < 500) {
      showAlert("Valor", "Informe um valor de pelo menos R$ 5,00.", "error");
      return;
    }
    setCardRejectMessage(null);
    setCardWaiting(false);
    setCardProcessing(false);
    setCardBrickKey((current) => current + 1);
    setCardModalOpen(true);
  }

  function closeCardModal() {
    if (cardProcessing || cardWaiting) return;
    setCardModalOpen(false);
    setCardRejectMessage(null);
  }

  async function handleDonateCard(data: {
    cardToken: string;
    paymentMethodId: string;
    issuerId?: string | number | null;
    installments: number;
  }) {
    setCardRejectMessage(null);
    setCardProcessing(true);
    try {
      const result = await payVaquinhaWithCard({
        token,
        amountText,
        isAnonymous,
        donorName,
        donorPhone,
        cardToken: data.cardToken,
        paymentMethodId: data.paymentMethodId,
        issuerId: data.issuerId,
        installments: data.installments,
      });

      if (!result.ok || !result.order) {
        setCardRejectMessage(
          result.message || "Pagamento recusado. Tente outro cartão."
        );
        setCardBrickKey((current) => current + 1);
        throw new Error(result.message || "Pagamento recusado");
      }

      setActiveOrder(result.order);

      if (result.order.status === "paid") {
        setPaymentConfirmed(true);
        setCardModalOpen(false);
        setCardWaiting(false);
        const refreshed = await getVaquinhaOrderPaymentStatus({
          token,
          orderId: result.order.id,
        });
        if (refreshed.vaquinha) setVaquinha(refreshed.vaquinha);
        showAlert("Doação confirmada", "Obrigado pelo apoio!", "success");
        return;
      }

      setCardWaiting(true);
      setPaymentConfirmed(false);
    } finally {
      setCardProcessing(false);
    }
  }

  async function copyPix() {
    if (!activeOrder?.pixCopyPaste) return;
    try {
      await navigator.clipboard.writeText(activeOrder.pixCopyPaste);
      showAlert("Pix copiado", "Cole no app do seu banco.", "success");
    } catch {
      showAlert("Não copiou", "Selecione o código e copie manualmente.", "error");
    }
  }

  const showPix =
    Boolean(activeOrder) &&
    activeOrder?.status === "awaiting_payment" &&
    activeOrder.paymentMethod === "pix" &&
    Boolean(activeOrder.pixCopyPaste || activeOrder.pixTicketUrl);

  const qrSrc = activeOrder?.pixQrBase64
    ? `data:image/png;base64,${activeOrder.pixQrBase64}`
    : activeOrder?.pixCopyPaste
      ? pixQrImageUrl(activeOrder.pixCopyPaste)
      : null;

  const showDonateForm =
    vaquinha.acceptsDonations && !showPix && !paymentConfirmed;

  return (
    <div className="flex flex-col gap-5">
      {vaquinha.photoUrls.length > 0 ? (
        <VaquinhaPhotoCarousel urls={vaquinha.photoUrls} />
      ) : null}

      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
        <h1 className="text-2xl font-bold tracking-tight text-stone-900">
          {vaquinha.title}
        </h1>
        {vaquinha.description ? (
          <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-stone-600">
            {vaquinha.description.trimEnd()}
          </p>
        ) : null}

        <div className="mt-4 space-y-2">
          <div className="flex items-end justify-between gap-3">
            <p className="text-sm font-semibold text-stone-900">
              {formatCentsBrl(vaquinha.raisedCents)}
              <span className="font-normal text-stone-500">
                {" "}
                de {formatCentsBrl(vaquinha.goalCents)}
              </span>
            </p>
            <p className="text-sm font-semibold text-brand-dark">{percent}%</p>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-stone-200">
            <div
              className="h-full rounded-full bg-brand-dark transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="text-sm text-stone-600">
            {vaquinha.paidCount}{" "}
            {vaquinha.paidCount === 1 ? "doação" : "doações"}
            {endsAtLabel ? ` · até ${endsAtLabel}` : ""}
            {!vaquinha.acceptsDonations ? " · Encerrada" : ""}
          </p>
        </div>
      </div>

      {paymentConfirmed ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-semibold text-emerald-900">
            Doação confirmada. Obrigado pelo apoio!
          </p>
        </div>
      ) : null}

      {showPix && activeOrder ? (
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
          <h2 className="text-lg font-semibold text-stone-900">Pague com Pix</h2>
          <p className="mt-1 text-sm text-stone-600">
            Valor: {formatCentsBrl(activeOrder.amountCents)}
          </p>
          {remainingMs != null ? (
            <p className="mt-2 text-sm font-semibold text-amber-900">
              Tempo restante: {formatCountdown(remainingMs)}
            </p>
          ) : null}
          {qrSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrSrc}
              alt="QR Code Pix"
              className="mx-auto mt-4 h-52 w-52 rounded-2xl border border-stone-200 bg-white p-2"
            />
          ) : null}
          {activeOrder.pixCopyPaste ? (
            <div className="mt-4 space-y-2">
              <p className="break-all rounded-xl bg-stone-100 px-3 py-3 text-xs text-stone-700">
                {activeOrder.pixCopyPaste}
              </p>
              <button
                type="button"
                onClick={() => void copyPix()}
                className="flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white"
              >
                Copiar Pix
              </button>
            </div>
          ) : null}
          {activeOrder.pixTicketUrl ? (
            <a
              href={activeOrder.pixTicketUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl border border-brand-dark text-base font-semibold text-brand-dark"
            >
              Abrir ticket do Pix
            </a>
          ) : null}
        </div>
      ) : null}

      {showDonateForm ? (
        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)]">
          <h2 className="text-lg font-semibold text-stone-900">Doar</h2>
          <p className="mt-1 text-sm text-stone-600">
            Valor livre · mínimo R$ 5,00
          </p>

          <label className="mt-4 block text-sm font-medium text-stone-700">
            Valor (R$)
            <input
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3"
              value={amountText}
              onChange={(event) => setAmountText(event.target.value)}
              inputMode="decimal"
              placeholder="20,00"
            />
          </label>

          {SHOW_CARD_PAYMENT ? (
            <div className="mt-4 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPayMethod("pix")}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    payMethod === "pix"
                      ? "border-brand-dark bg-brand-dark text-white"
                      : "border-stone-300 bg-white text-stone-800"
                  }`}
                >
                  Pix
                </button>
                <button
                  type="button"
                  onClick={() => setPayMethod("credit_card")}
                  className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
                    payMethod === "credit_card"
                      ? "border-brand-dark bg-brand-dark text-white"
                      : "border-stone-300 bg-white text-stone-800"
                  }`}
                >
                  Cartão de crédito
                </button>
              </div>
              {payMethod === "credit_card" &&
              cardChargeCents != null &&
              cardFeeCents != null ? (
                <p className="text-xs text-stone-600">
                  No cartão de crédito, a taxa do Mercado Pago (4,98%) fica no
                  cobrado: {formatCentsBrl(cardChargeCents)} (doação{" "}
                  {formatCentsBrl(amountCents!)} + taxa{" "}
                  {formatCentsBrl(cardFeeCents)}).
                </p>
              ) : null}
            </div>
          ) : null}

          <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(event) => setIsAnonymous(event.target.checked)}
              className="h-4 w-4 accent-brand-dark"
            />
            <span className="text-sm font-medium text-stone-800">
              Doar como anônimo
            </span>
          </label>

          {!isAnonymous ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-stone-700">
                Nome completo
                <input
                  className={`mt-1 w-full rounded-xl border px-3 py-3 ${fieldBorderClass(Boolean(nameTouched && nameError))}`}
                  value={donorName}
                  onChange={(event) => setDonorName(event.target.value)}
                  onBlur={() => setNameTouched(true)}
                  autoComplete="name"
                />
                {nameTouched && nameError ? (
                  <FieldError id="vaquinha-name-error" message={nameError} />
                ) : null}
              </label>
              <label className="block text-sm font-medium text-stone-700">
                WhatsApp
                <input
                  className={`mt-1 w-full rounded-xl border px-3 py-3 ${fieldBorderClass(Boolean(phoneTouched && phoneErr))}`}
                  value={donorPhone}
                  onChange={(event) =>
                    setDonorPhone(maskPhone(event.target.value))
                  }
                  onBlur={() => setPhoneTouched(true)}
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="(42) 99999-9999"
                />
                {phoneTouched && phoneErr ? (
                  <FieldError id="vaquinha-phone-error" message={phoneErr} />
                ) : null}
              </label>
            </div>
          ) : null}

          {SHOW_CARD_PAYMENT && payMethod === "credit_card" ? (
            <button
              type="button"
              disabled={amountText.trim().length === 0}
              onClick={openCardModal}
              className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white shadow-sm transition hover:bg-brand-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/40 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-60 disabled:shadow-none"
            >
              Pagar com cartão de crédito
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || amountText.trim().length === 0}
              onClick={handleDonatePix}
              className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white shadow-sm transition hover:bg-brand-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/40 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-60 disabled:shadow-none"
            >
              {pending ? "Gerando Pix..." : "Doar com Pix"}
            </button>
          )}
        </div>
      ) : null}

      {!vaquinha.acceptsDonations && !showPix ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">
            Esta vaquinha não está aceitando doações no momento.
          </p>
        </div>
      ) : null}

      {SHOW_CARD_PAYMENT &&
      cardModalOpen &&
      amountCents != null &&
      amountCents >= 500 ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/45"
          role="dialog"
          aria-modal="true"
          aria-labelledby="vaquinha-card-title"
        >
          <div className="mx-auto w-full max-w-lg px-5 compact:px-2.5">
            <div
              className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[1.75rem] border border-white/70 bg-white shadow-[0_24px_60px_rgba(14,90,88,0.28)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 items-start justify-between gap-3 bg-brand-dark px-5 py-4 text-white">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/75">
                    Cartão de crédito
                  </p>
                  <h2
                    id="vaquinha-card-title"
                    className="mt-1 text-xl font-bold tracking-tight"
                  >
                    Pagar doação
                  </h2>
                  <p className="mt-1 text-sm text-white/85">
                    Total {formatCentsBrl(cardChargeCents ?? amountCents)}
                  </p>
                  {cardFeeCents != null && cardChargeCents != null ? (
                    <p className="mt-0.5 text-xs text-white/70">
                      Doação {formatCentsBrl(amountCents)} + taxa{" "}
                      {formatCentsBrl(cardFeeCents)}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  aria-label="Fechar"
                  disabled={cardProcessing || cardWaiting}
                  className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-xl bg-white/15 text-xl leading-none transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={closeCardModal}
                >
                  ×
                </button>
              </div>

              <div className="overflow-y-auto overscroll-contain px-4 py-4">
                {cardWaiting ? (
                  <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                    <p className="text-sm font-semibold text-sky-950">
                      Aguardando confirmação do pagamento...
                    </p>
                    <p className="mt-1 text-sm text-sky-800">
                      A modal fecha automaticamente quando o pagamento for
                      aprovado.
                    </p>
                  </div>
                ) : (
                  <>
                    {cardRejectMessage ? (
                      <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
                        <p className="text-sm font-semibold text-rose-900">
                          Pagamento recusado
                        </p>
                        <p className="mt-1 text-sm text-rose-800">
                          {cardRejectMessage}
                        </p>
                      </div>
                    ) : null}
                    <VaquinhaCardBrick
                      amountCents={cardChargeCents ?? amountCents}
                      brickKey={`card-${cardBrickKey}`}
                      disabled={cardProcessing}
                      onPay={handleDonateCard}
                      onError={(message) => setCardRejectMessage(message)}
                    />
                    {cardProcessing ? (
                      <p className="mt-3 text-sm font-medium text-brand-dark">
                        Processando cartão...
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <SiteAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
