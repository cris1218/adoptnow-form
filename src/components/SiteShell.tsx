import type { ReactNode } from "react";
import Link from "next/link";

import { PawMark } from "@/components/PawMark";

export function SiteShell({
  eyebrow = "Recanto do Ron Ron",
  title = "Adoção responsável",
  layout = "narrow",
  children,
}: {
  eyebrow?: string;
  title?: string;
  layout?: "narrow" | "wide";
  children: ReactNode;
}) {
  const widthClass =
    layout === "wide"
      ? "max-w-lg md:max-w-3xl lg:max-w-5xl xl:max-w-6xl"
      : "max-w-lg";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-brand-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-64 w-64 rounded-full bg-brand-light/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[28rem] left-[-5rem] h-72 w-72 rounded-full bg-brand-dark/15 blur-3xl"
      />

      <div
        className={`relative z-10 mx-auto flex w-full flex-1 flex-col px-5 compact:px-2.5 md:px-6 lg:px-8 ${widthClass}`}
      >
        <header className="pt-[max(1.25rem,env(safe-area-inset-top))]">
          <div className="flex items-end justify-between gap-3 pt-4">
            <div className="flex min-w-0 items-end gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-dark text-white shadow-sm">
                <PawMark className="h-6 w-6" />
              </span>
              <div className="min-w-0 pb-0.5">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
                  {eyebrow}
                </p>
                <p className="text-sm text-stone-600">{title}</p>
              </div>
            </div>
            {layout === "wide" ? (
              <Link
                href="/"
                className="inline-flex h-11 shrink-0 items-center rounded-xl border border-brand-dark/20 bg-white/80 px-3 text-sm font-semibold text-brand-dark shadow-sm transition hover:bg-brand-bg hover:text-brand-950"
              >
                ← Home
              </Link>
            ) : null}
          </div>
        </header>

        <main className="flex flex-1 flex-col gap-4 py-6">{children}</main>

        <footer className="pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center">
          <p className="pb-4 text-xs text-stone-500">
            Recanto do Ron Ron · seus dados são usados só para o processo de
            adoção
          </p>
        </footer>
      </div>
    </div>
  );
}
