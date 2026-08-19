"use client";

import { useState } from "react";

import { AdoptionLeadForm } from "@/components/AdoptionLeadForm";
import { ProcessInfo } from "@/components/ProcessInfo";

export function AdoptionFlow({
  token = "",
  preview = false,
}: {
  token?: string;
  preview?: boolean;
}) {
  const [agreed, setAgreed] = useState(false);

  function goToQuestionnaire() {
    setAgreed(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
      {agreed ? (
        <AdoptionLeadForm token={token} preview={preview} />
      ) : (
        <div className="space-y-4">
          {preview ? (
            <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium leading-relaxed text-amber-900">
              Visualização de teste. O envio está desativado.
            </p>
          ) : null}
          <ProcessInfo />
          <button
            type="button"
            onClick={goToQuestionnaire}
            className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition active:scale-[0.99] hover:bg-brand-950"
          >
            Concordo
          </button>
        </div>
      )}
    </section>
  );
}
