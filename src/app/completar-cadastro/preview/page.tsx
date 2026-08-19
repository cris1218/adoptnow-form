import type { Metadata } from "next";

import { CompletionForm } from "@/app/completar-cadastro/CompletionForm";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Completar cadastro (teste) | Recanto do Ron Ron",
  description: "Visualização do formulário de completar cadastro. Envio desativado.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CompletarCadastroPreviewPage() {
  return (
    <SiteShell title="Completar cadastro">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
        <CompletionForm token="" phoneCipher="" preview />
      </section>
    </SiteShell>
  );
}
