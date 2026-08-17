"use client";

import { useEffect, useState } from "react";

import { PawMark } from "@/components/PawMark";
import {
  formatBirthDateApprox,
  formatCatSexLabel,
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
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoUrl = cat.photoUrl;
  const quarantineUntil = formatIsoDateBr(cat.quarantineReleasedAt);

  useEffect(() => {
    if (!photoOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setPhotoOpen(false);
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [photoOpen]);

  return (
    <>
      <div className="mt-3 rounded-2xl border border-brand-light/40 bg-brand-bg/70 p-3">
        <div className="flex items-stretch gap-3">
          <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-2">
            <Detail label="Nome" value={cat.name} />
            <Detail label="Cor do pelo" value={cat.furColor || "Não informada"} />
            <Detail label="Sexo" value={formatCatSexLabel(cat.sex)} />
            <Detail
              label="Nascimento aprox."
              value={formatBirthDateApprox(cat.birthDateApprox)}
            />
          </div>
          {photoUrl ? (
            <button
              type="button"
              onClick={() => setPhotoOpen(true)}
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

      {photoOpen && photoUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setPhotoOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={`Foto de ${cat.name}`}
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-stone-800"
            onClick={() => setPhotoOpen(false)}
          >
            Fechar
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photoUrl}
            alt={cat.name}
            className="max-h-[85dvh] max-w-[min(92vw,40rem)] rounded-2xl object-contain shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}
    </>
  );
}
