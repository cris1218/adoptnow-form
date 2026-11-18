"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react";

type CardFormData = {
  token: string;
  payment_method_id: string;
  installments: number;
  issuer_id?: string | number;
};

type Props = {
  amountCents: number;
  disabled?: boolean;
  brickKey?: string;
  onPay: (data: {
    cardToken: string;
    paymentMethodId: string;
    issuerId?: string | number | null;
    installments: number;
  }) => Promise<void>;
  onError?: (message: string) => void;
};

/** Parcela mínima R$ 100 → 2x só a partir de R$ 200. */
export function maxCardInstallments(amountCents: number): number {
  return Math.max(1, Math.floor(amountCents / 10_000));
}

export function VaquinhaCardBrick({
  amountCents,
  disabled = false,
  brickKey,
  onPay,
  onError,
}: Props) {
  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY?.trim() || "";
  const [sdkReady, setSdkReady] = useState(false);
  const [brickReady, setBrickReady] = useState(false);

  const amount = useMemo(
    () => Number((amountCents / 100).toFixed(2)),
    [amountCents]
  );
  const maxInstallments = maxCardInstallments(amountCents);
  const containerId = useMemo(
    () =>
      `vaquinhaCardBrick_${String(brickKey ?? amountCents).replace(/\W+/g, "_")}`,
    [brickKey, amountCents]
  );

  const onPayRef = useRef(onPay);
  const onErrorRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const maxInstallmentsRef = useRef(maxInstallments);

  useEffect(() => {
    onPayRef.current = onPay;
  }, [onPay]);
  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);
  useEffect(() => {
    disabledRef.current = disabled;
  }, [disabled]);
  useEffect(() => {
    maxInstallmentsRef.current = maxInstallments;
  }, [maxInstallments]);

  useEffect(() => {
    if (!publicKey) return;
    try {
      initMercadoPago(publicKey, { locale: "pt-BR" });
      setSdkReady(true);
    } catch (error) {
      console.error("initMercadoPago", error);
      onErrorRef.current?.(
        error instanceof Error
          ? error.message
          : "Não foi possível iniciar o Mercado Pago."
      );
    }
  }, [publicKey]);

  useEffect(() => {
    setBrickReady(false);
  }, [amountCents, brickKey, maxInstallments, containerId]);

  // Callbacks estáveis: o Brick remonta se onReady/onSubmit/onError mudarem.
  const handleReady = useCallback(() => {
    setBrickReady(true);
  }, []);

  const handleError = useCallback((error: { message?: string } | string) => {
    console.error("CardPayment brick", error);
    const message =
      (typeof error === "string" && error) ||
      (error &&
        typeof error === "object" &&
        typeof error.message === "string" &&
        error.message) ||
      "Falha no formulário de cartão. Tente de novo.";
    onErrorRef.current?.(message);
  }, []);

  const handleSubmit = useCallback(async (formData: CardFormData) => {
    if (disabledRef.current) return;
    const token = String(formData.token ?? "").trim();
    const paymentMethodId = String(formData.payment_method_id ?? "").trim();
    const max = maxInstallmentsRef.current;
    const installments = Math.max(
      1,
      Math.min(Number(formData.installments) || 1, max)
    );
    if (!token || !paymentMethodId) {
      onErrorRef.current?.("Não foi possível tokenizar o cartão.");
      throw new Error("Dados do cartão incompletos.");
    }
    await onPayRef.current({
      cardToken: token,
      paymentMethodId,
      issuerId: formData.issuer_id ?? null,
      installments,
    });
  }, []);

  const initialization = useMemo(() => ({ amount }), [amount]);
  const customization = useMemo(
    () => ({
      paymentMethods: {
        maxInstallments,
      },
    }),
    [maxInstallments]
  );

  if (!publicKey) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
        Pagamento com cartão indisponível no momento. Use Pix.
      </p>
    );
  }

  if (!sdkReady || !(amount >= 5)) {
    return (
      <p className="text-sm text-stone-500">
        Informe um valor de pelo menos R$ 5,00 para pagar com cartão.
      </p>
    );
  }

  return (
    <div
      className={`relative min-h-[28rem] ${
        disabled ? "pointer-events-none opacity-60" : ""
      }`}
      aria-disabled={disabled}
    >
      {!brickReady ? (
        <p className="mb-3 text-sm text-stone-500">
          Carregando formulário do cartão...
        </p>
      ) : null}
      <CardPayment
        id={containerId}
        key={`${containerId}-${amountCents}-${maxInstallments}`}
        locale="pt-BR"
        initialization={initialization}
        customization={customization}
        onReady={handleReady}
        onSubmit={handleSubmit}
        onError={handleError}
      />
    </div>
  );
}
