import type { Metadata } from "next";

import { AdoptionFlow } from "@/components/AdoptionFlow";
import { SiteShell } from "@/components/SiteShell";

export const metadata: Metadata = {
  title: "Questionário de adoção (teste) | Recanto do Ron Ron",
  description: "Visualização do questionário inicial. Envio desativado.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdoptionFormPreviewPage() {
  return (
    <SiteShell>
      <AdoptionFlow preview />
    </SiteShell>
  );
}
