"use client";

import { useEffect, useMemo, useState } from "react";
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
  const [ready, setReady] = useState(false);
  const amount = useMemo(
    () => Number((amountCents / 100).toFixed(2)),
    [amountCents]
  );
  const maxInstallments = maxCardInstallments(amountCents);

  useEffect(() => {
    if (!publicKey) return;
    initMercadoPago(publicKey, { locale: "pt-BR" });
    setReady(true);
  }, [publicKey]);

  if (!publicKey) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
        Pagamento com cartão indisponível no momento. Use Pix.
      </p>
    );
  }

  if (!ready || !(amount >= 5)) {
    return (
      <p className="text-sm text-stone-500">
        Informe um valor de pelo menos R$ 5,00 para pagar com cartão.
      </p>
    );
  }

  return (
    <div
      className={disabled ? "pointer-events-none opacity-60" : undefined}
      aria-disabled={disabled}
    >
      <CardPayment
        key={brickKey ?? `card-brick-${amountCents}-${maxInstallments}`}
        locale="pt-BR"
        initialization={{ amount }}
        customization={{
          paymentMethods: {
            maxInstallments,
          },
        }}
        onSubmit={async (formData: CardFormData) => {
          if (disabled) return;
          const token = String(formData.token ?? "").trim();
          const paymentMethodId = String(
            formData.payment_method_id ?? ""
          ).trim();
          const installments = Math.max(
            1,
            Math.min(Number(formData.installments) || 1, maxInstallments)
          );
          if (!token || !paymentMethodId) {
            onError?.("Não foi possível tokenizar o cartão.");
            throw new Error("Dados do cartão incompletos.");
          }
          await onPay({
            cardToken: token,
            paymentMethodId,
            issuerId: formData.issuer_id ?? null,
            installments,
          });
        }}
        onError={(error) => {
          console.error("CardPayment brick", error);
          onError?.(
            error?.message || "Falha no formulário de cartão. Tente de novo."
          );
        }}
      />
    </div>
  );
}
