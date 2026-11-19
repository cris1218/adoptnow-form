import type { Metadata } from "next";

import { RecantoCampaignsList } from "@/components/RecantoCampaignsList";
import { RecantoSiteChrome } from "@/components/RecantoSiteChrome";
import { loadHomeCampaigns } from "@/app/homeActions";

export const metadata: Metadata = {
  title: "Campanhas | Recanto do Ron Ron",
  description:
    "Rifas e vaquinhas abertas para apoiar o Recanto do Ron Ron em Ponta Grossa.",
};

export default async function CampanhasPage() {
  const { raffles, vaquinhas } = await loadHomeCampaigns();

  return (
    <RecantoSiteChrome>
      <div className="mb-5 sm:mb-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-stone-900 sm:text-3xl">
          Campanhas abertas
        </h1>
        <p className="mt-2 text-sm text-stone-600 sm:text-base">
          Rifas e vaquinhas ativas para apoiar o Recanto.
        </p>
      </div>
      <RecantoCampaignsList raffles={raffles} vaquinhas={vaquinhas} />
    </RecantoSiteChrome>
  );
}
