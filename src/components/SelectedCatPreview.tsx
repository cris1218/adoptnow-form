"use client";

import { useEffect, useRef } from "react";

import { PawMark } from "@/components/PawMark";
import {
  formatApproximateAge,
  formatCatSexLabel,
  formatFivFelvResult,
  formatIsoDateBr,
  type AvailableAdoptionCat,
} from "@/lib/availableCats";

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-stone-500">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold leading-snug text-stone-900">
        {value}
      </p>
    </div>
  );
}

export function SelectedCatPreview({ cat }: { cat: AvailableAdoptionCat }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const photoUrl = cat.photoUrl;
  const quarantineUntil = formatIsoDateBr(cat.quarantineReleasedAt);
  const fiv = formatFivFelvResult(cat.fiv);
  const felv = formatFivFelvResult(cat.felv);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    function onClose() {
      document.body.style.overflow = "";
    }

    dialog.addEventListener("close", onClose);
    return () => {
      dialog.removeEventListener("close", onClose);
      document.body.style.overflow = "";
    };
  }, []);

  function openPhoto() {
    const dialog = dialogRef.current;
    if (!dialog || !photoUrl) return;
    if (!dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
  }

  function closePhoto() {
    const dialog = dialogRef.current;
    if (dialog?.open) dialog.close();
    document.body.style.overflow = "";
  }

  return (
    <>
      <div className="mt-3 rounded-2xl border border-brand-light/40 bg-brand-bg/70 p-3">
        <div className="flex items-stretch gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2">
            <Detail label="Nome" value={cat.name} />
            <Detail label="Cor do pelo" value={cat.furColor || "Não informada"} />
            <Detail label="Sexo" value={formatCatSexLabel(cat.sex)} />
            <Detail
              label="Idade aprox."
              value={formatApproximateAge(cat.birthDateApprox)}
            />
            {fiv ? <Detail label="FIV" value={fiv} /> : null}
            {felv ? <Detail label="FELV" value={felv} /> : null}
          </div>
          {photoUrl ? (
            <button
              type="button"
              onClick={openPhoto}
              className="h-24 w-24 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-stone-200"
              aria-label={`Ampliar foto de ${cat.name}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt={cat.name}
                className="h-full w-full object-cover"
              />
            </button>
          ) : (
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-light ring-1 ring-stone-200">
              <PawMark className="h-10 w-10" />
            </div>
          )}
        </div>
        {quarantineUntil ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
            Em quarentena até {quarantineUntil}
          </p>
        ) : null}
      </div>

      {photoUrl ? (
        <dialog
          ref={dialogRef}
          aria-label={`Foto de ${cat.name}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closePhoto();
          }}
          onCancel={closePhoto}
          className="fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-black/85 p-0 open:flex"
        >
          <div
            className="relative flex h-full w-full items-center justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(4.5rem,calc(env(safe-area-inset-top)+3.5rem))]"
            onClick={closePhoto}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                closePhoto();
              }}
              className="absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold leading-none text-stone-800 shadow-lg"
              aria-label="Fechar foto"
            >
              ×
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={cat.name}
              className="max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          </div>
        </dialog>
      ) : null}
    </>
  );
}
