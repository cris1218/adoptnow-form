"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import {
  createVaquinhaDonation,
  getVaquinhaOrderPaymentStatus,
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
  formatCentsBrl,
  vaquinhaProgressPercent,
  type DonationOrder,
  type PublicVaquinha,
} from "@/lib/vaquinhas";

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

export function VaquinhaClient({
  token,
  initialVaquinha,
}: {
  token: string;
  initialVaquinha: PublicVaquinha;
}) {
  const [vaquinha, setVaquinha] = useState(initialVaquinha);
  const [amountText, setAmountText] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [donorName, setDonorName] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [activeOrder, setActiveOrder] = useState<DonationOrder | null>(null);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
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

  const nameError = !isAnonymous ? fullNameError(donorName) : null;
  const phoneErr = !isAnonymous ? phoneError(donorPhone) : null;

  const expiresMs = parseExpiresAtMs(activeOrder?.expiresAt ?? null);
  const remainingMs =
    activeOrder?.status === "awaiting_payment" && expiresMs != null
      ? expiresMs - nowMs
      : null;

  useEffect(() => {
    if (activeOrder?.status !== "awaiting_payment") return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [activeOrder?.status]);

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

  function handleDonate() {
    if (!vaquinha.acceptsDonations) {
      showAlert(
        "Vaquinha encerrada",
        "Esta campanha não está aceitando doações.",
        "error"
      );
      return;
    }

    if (!isAnonymous) {
      setNameTouched(true);
      setPhoneTouched(true);
      if (nameError || phoneErr) return;
    }

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
    Boolean(activeOrder.pixCopyPaste || activeOrder.pixTicketUrl);

  const qrSrc = activeOrder?.pixQrBase64
    ? `data:image/png;base64,${activeOrder.pixQrBase64}`
    : activeOrder?.pixCopyPaste
      ? pixQrImageUrl(activeOrder.pixCopyPaste)
      : null;

  return (
    <div className="flex flex-col gap-5">
      {vaquinha.photoUrls[0] ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={vaquinha.photoUrls[0]}
          alt={vaquinha.title}
          className="h-52 w-full rounded-[1.75rem] object-cover shadow-[0_18px_50px_rgba(14,90,88,0.12)]"
        />
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

      {vaquinha.acceptsDonations && !showPix ? (
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

          <button
            type="button"
            disabled={pending || amountText.trim().length === 0}
            onClick={handleDonate}
            className="mt-5 flex h-12 w-full cursor-pointer items-center justify-center rounded-2xl bg-brand-dark text-base font-semibold text-white shadow-sm transition hover:bg-brand-950 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-dark/40 focus-visible:ring-offset-2 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-500 disabled:opacity-60 disabled:shadow-none"
          >
            {pending ? "Gerando Pix..." : "Doar com Pix"}
          </button>
        </div>
      ) : null}

      {!vaquinha.acceptsDonations && !showPix ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-950">
            Esta vaquinha não está aceitando doações no momento.
          </p>
        </div>
      ) : null}

      <SiteAlert alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}
