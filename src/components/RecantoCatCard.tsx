"use client";

import { useEffect, useRef, useState } from "react";

import { PawMark } from "@/components/PawMark";
import {
  formatApproximateAge,
  formatCatSexLabel,
  type AvailableAdoptionCat,
} from "@/lib/availableCats";
import { whatsappInterestLink } from "@/lib/recantoContact";

export function RecantoCatCard({ cat }: { cat: AvailableAdoptionCat }) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (lightboxOpen) {
      if (!dialog.open) dialog.showModal();
      document.body.style.overflow = "hidden";
    } else {
      if (dialog.open) dialog.close();
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxOpen]);

  return (
    <>
      <article className="overflow-hidden rounded-[1.25rem] border border-white/70 bg-white/95 shadow-[0_12px_32px_rgba(14,90,88,0.1)]">
        <button
          type="button"
          aria-label={`Ampliar foto de ${cat.name}`}
          onClick={() => {
            if (cat.photoUrl) setLightboxOpen(true);
          }}
          className={`block w-full cursor-zoom-in border-0 bg-transparent p-0 ${
            cat.photoUrl ? "" : "cursor-default"
          }`}
        >
          {cat.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cat.photoUrl}
              alt={cat.name}
              className="aspect-[4/5] w-full object-cover"
            />
          ) : (
            <div className="flex aspect-[4/5] w-full items-center justify-center bg-brand-bg text-brand-dark">
              <PawMark className="h-10 w-10 opacity-70" />
            </div>
          )}
        </button>
        <div className="space-y-0.5 p-3">
          <p className="truncate text-base font-bold tracking-tight text-stone-900">
            {cat.name}
          </p>
          <p className="truncate text-xs text-stone-600 sm:text-sm">
            {formatCatSexLabel(cat.sex)}
            {cat.birthDateApprox
              ? ` · ${formatApproximateAge(cat.birthDateApprox)}`
              : ""}
          </p>
          <a
            href={whatsappInterestLink(cat.name)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex pt-1 text-xs font-semibold text-brand-dark transition hover:text-brand-950 sm:text-sm"
          >
            Quero adotar →
          </a>
        </div>
      </article>

      <dialog
        ref={dialogRef}
        aria-label={`Foto de ${cat.name}`}
        onClose={() => setLightboxOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setLightboxOpen(false);
        }}
        className="recanto-lightbox fixed inset-0 z-50 m-0 h-dvh max-h-none w-screen max-w-none border-0 bg-transparent p-0 open:flex"
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
            className="recanto-lightbox-ui absolute right-4 top-[max(0.75rem,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-white text-xl font-bold leading-none text-stone-800 shadow-lg"
            aria-label="Fechar foto"
          >
            ×
          </button>
          {cat.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cat.photoUrl}
              alt={cat.name}
              className="recanto-lightbox-image max-h-full max-w-full object-contain"
              onClick={(event) => event.stopPropagation()}
            />
          ) : null}
        </div>
      </dialog>
    </>
  );
}
