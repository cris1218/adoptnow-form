import type { ReactNode } from "react";
import Link from "next/link";

import { PawMark } from "@/components/PawMark";
import { RecantoPageTransition } from "@/components/RecantoPageTransition";
import { RecantoSiteNav } from "@/components/RecantoSiteNav";
import { CONTACT_WHATSAPP_LINK } from "@/lib/recantoContact";

export function RecantoSiteChrome({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-dvh overflow-x-hidden bg-brand-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-64 w-64 rounded-full bg-brand-light/25 blur-3xl md:h-96 md:w-96"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[32rem] left-[-5rem] h-72 w-72 rounded-full bg-brand-dark/15 blur-3xl md:top-[40rem]"
      />

      <header className="relative z-10 border-b border-stone-200/70 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:gap-6 sm:px-6 sm:py-4 lg:px-8">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-dark text-white shadow-sm sm:h-11 sm:w-11">
              <PawMark className="h-5 w-5 sm:h-6 sm:w-6" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold tracking-tight text-stone-900 sm:text-base">
                Recanto do Ron Ron
              </p>
              <p className="hidden truncate text-xs text-stone-500 sm:block">
                Adoção responsável · Ponta Grossa / PR
              </p>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-4 sm:gap-6">
            <div className="hidden sm:block">
              <RecantoSiteNav />
            </div>
            <a
              href={CONTACT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-brand-dark px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-950 sm:h-10 sm:px-4"
            >
              WhatsApp
            </a>
          </div>
        </div>

        <div className="border-t border-stone-200/60 px-4 py-2.5 sm:hidden">
          <div className="mx-auto flex max-w-6xl justify-center">
            <RecantoSiteNav />
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
        <RecantoPageTransition>{children}</RecantoPageTransition>
      </main>

      <footer className="relative z-10 border-t border-stone-200/70 px-4 py-6 text-center sm:px-6 lg:px-8">
        <p className="text-xs text-stone-500 sm:text-sm">
          Recanto do Ron Ron · Ponta Grossa / PR
        </p>
      </footer>
    </div>
  );
}
