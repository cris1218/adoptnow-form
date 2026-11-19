import type { Metadata } from "next";

import { RecantoCatsGallery } from "@/components/RecantoCatsGallery";
import { RecantoSiteChrome } from "@/components/RecantoSiteChrome";
import { loadHomeCampaigns } from "@/app/homeActions";

export const metadata: Metadata = {
  title: "Gatinhos para adoção | Recanto do Ron Ron",
  description:
    "Conheça os gatinhos disponíveis para adoção no Recanto do Ron Ron e fale conosco pelo WhatsApp.",
};

export default async function GatinhosPage() {
  const { cats } = await loadHomeCampaigns();

  return (
    <RecantoSiteChrome>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          Gatinhos para adoção
        </h1>
        <p className="mt-2 text-sm text-stone-600 sm:text-base">
          Toque na foto para ampliar. Em “Quero adotar”, avisamos no WhatsApp.
        </p>
      </div>
      <RecantoCatsGallery cats={cats} />
    </RecantoSiteChrome>
  );
}
