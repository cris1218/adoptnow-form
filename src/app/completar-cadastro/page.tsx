import type { Metadata } from "next";

import { CompletionForm } from "@/app/completar-cadastro/CompletionForm";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Completar cadastro | Recanto do Ron Ron",
  description:
    "Preencha CPF e endereço para concluir seu cadastro de adoção no Recanto do Ron Ron.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function CompletarCadastroPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; p?: string }>;
}) {
  const { token, p } = await searchParams;

  return (
    <SiteShell title="Completar cadastro">
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
        <CompletionForm token={token?.trim() ?? ""} phoneCipher={p?.trim() ?? ""} />
      </section>
    </SiteShell>
  );
}
