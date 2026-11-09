"use client";

import { useMemo, useState, useTransition } from "react";

import {
  lookupRaffleOrdersByPhone,
  purchaseRaffleNumbers,
} from "@/app/rifa/actions";
import {
  formatCentsBrl,
  type BuyerOrder,
  type PublicRaffle,
  type PublicRaffleNumber,
  type RaffleNumberStatus,
} from "@/lib/raffles";
import { isValidPhone, maskPhone } from "@/lib/masks";

function cellClass(status: RaffleNumberStatus, selected: boolean) {
  if (selected) return "border-brand-dark bg-brand-dark text-white";
  if (status === "paid") return "border-emerald-600 bg-emerald-50 text-emerald-900";
  if (status === "reserved") return "border-amber-500 bg-amber-50 text-amber-900";
  return "border-stone-300 bg-white text-stone-900";
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
  const [lookupPhone, setLookupPhone] = useState("");
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [activeOrder, setActiveOrder] = useState<BuyerOrder | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canBuy = raffle.status === "open";
  const totalCents = selected.length * raffle.priceCents;

  const selectedSet = useMemo(() => new Set(selected), [selected]);

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
    startTransition(async () => {
      const result = await lookupRaffleOrdersByPhone(token, lookupPhone);
      if (!result.ok) {
        setMessage(result.message || "Não encontramos pedidos.");
        setOrders([]);
        return;
      }
      setOrders(result.orders);
      const pendingPix = result.orders.find(
        (order) => order.status === "pending" && order.pixCopyPaste
      );
      if (pendingPix) setActiveOrder(pendingPix);
      if (result.orders.length === 0) {
        setMessage("Nenhum pedido para este WhatsApp nesta rifa.");
      }
    });
  }

  function handlePurchase() {
    setMessage(null);
    startTransition(async () => {
      const result = await purchaseRaffleNumbers({
        token,
        numbers: selected,
        buyerName,
        buyerPhone,
      });
      if (!result.ok || !result.order) {
        setMessage(result.message || "Falha na compra.");
        const refreshed = await lookupRaffleOrdersByPhone(token, buyerPhone);
        void refreshed;
        // recarrega grade via reload simples
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
      setMessage("Pix gerado. Pague em até 30 minutos para garantir os números.");
    });
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
          <p className="mt-2 text-base leading-relaxed text-stone-600">
            {raffle.itemsDescription}
          </p>
        ) : null}
        <p className="mt-3 text-sm font-semibold text-brand-dark">
          {formatCentsBrl(raffle.priceCents)} por número
          {raffle.status !== "open"
            ? raffle.status === "drawn"
              ? ` · Sorteada${raffle.drawnNumber != null ? ` (#${raffle.drawnNumber})` : ""}`
              : " · Encerrada"
            : ""}
        </p>
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
            placeholder="(42) 99999-9999"
          />
        </label>
        <button
          type="button"
          disabled={pending || !isValidPhone(lookupPhone)}
          onClick={handleLookup}
          className="mt-3 flex h-12 w-full items-center justify-center rounded-2xl bg-stone-200 text-base font-semibold text-stone-900 disabled:opacity-50"
        >
          Buscar meus números
        </button>
        {orders.length > 0 ? (
          <ul className="mt-3 space-y-2">
            {orders.map((order) => (
              <li
                key={order.id}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => setActiveOrder(order)}
                >
                  {order.status === "paid" ? "Pago" : "Aguardando Pix"} · nº{" "}
                  {order.numbers.join(", ")} · {formatCentsBrl(order.totalCents)}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5">
        <h2 className="text-lg font-semibold text-stone-900">Números</h2>
        <p className="mt-1 text-sm text-stone-500">
          Verde = pago · Amarelo = reservado · Branco = livre
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {numbers.map((item) => {
            const selectedNow = selectedSet.has(item.number);
            const disabled = !canBuy || item.status !== "available";
            return (
              <button
                key={item.number}
                type="button"
                disabled={disabled && !selectedNow}
                onClick={() => toggleNumber(item)}
                className={`flex h-11 w-11 items-center justify-center rounded-lg border text-sm font-semibold disabled:opacity-70 ${cellClass(item.status, selectedNow)}`}
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
            {selected.length
              ? ` · Total ${formatCentsBrl(totalCents)}`
              : ""}
          </p>
          <label className="mt-3 block text-sm font-medium text-stone-700">
            Nome
            <input
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3"
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              placeholder="Seu nome"
            />
          </label>
          <label className="mt-3 block text-sm font-medium text-stone-700">
            WhatsApp
            <input
              className="mt-1 w-full rounded-xl border border-stone-300 px-3 py-3"
              value={buyerPhone}
              onChange={(event) => setBuyerPhone(maskPhone(event.target.value))}
              inputMode="numeric"
              placeholder="(42) 99999-9999"
            />
          </label>
          <button
            type="button"
            disabled={
              pending ||
              selected.length === 0 ||
              buyerName.trim().length < 2 ||
              !isValidPhone(buyerPhone)
            }
            onClick={handlePurchase}
            className="mt-4 flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white disabled:opacity-50"
          >
            {pending ? "Gerando Pix..." : "Gerar Pix"}
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Esta rifa não está aberta para novas compras.
        </p>
      )}

      {message ? (
        <p className="rounded-xl bg-stone-100 px-3 py-2 text-sm text-stone-700">
          {message}
        </p>
      ) : null}

      {activeOrder ? (
        <div className="rounded-[1.75rem] border border-brand-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-stone-900">
            {activeOrder.status === "paid" ? "Pagamento confirmado" : "Pix"}
          </h2>
          <p className="mt-1 text-sm text-stone-600">
            Números {activeOrder.numbers.join(", ")} ·{" "}
            {formatCentsBrl(activeOrder.totalCents)}
          </p>
          {activeOrder.status === "pending" && activeOrder.pixQrBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${activeOrder.pixQrBase64}`}
              alt="QR Code Pix"
              className="mx-auto mt-4 h-56 w-56 rounded-xl border border-stone-200"
            />
          ) : null}
          {activeOrder.status === "pending" && activeOrder.pixCopyPaste ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Copia e cola
              </p>
              <textarea
                readOnly
                className="mt-1 h-28 w-full rounded-xl border border-stone-300 p-3 text-xs"
                value={activeOrder.pixCopyPaste}
              />
              <button
                type="button"
                className="mt-2 flex h-12 w-full items-center justify-center rounded-2xl bg-stone-200 text-base font-semibold"
                onClick={() =>
                  void navigator.clipboard.writeText(activeOrder.pixCopyPaste)
                }
              >
                Copiar Pix
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <p className="text-center text-xs text-stone-400">
        A reserva dos números vale por 30 minutos até o pagamento do Pix.
      </p>
    </div>
  );
}
