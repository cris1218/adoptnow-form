import type { Metadata } from "next";

import { AdoptionFlow } from "@/components/AdoptionFlow";
import { FormClosedNotice } from "@/components/FormClosedNotice";
import { RecantoHome } from "@/components/RecantoHome";
import { SiteShell } from "@/components/SiteShell";
import { getAdoptionFormAccess, getExclusiveCatForm } from "@/app/actions";
import { loadHomeCampaigns } from "@/app/homeActions";

export const metadata: Metadata = {
  title: "Recanto do Ron Ron | Adoção, rifas e vaquinhas",
  description:
    "Abrigo de gatos em Ponta Grossa. Conheça o Recanto do Ron Ron, apoie rifas e vaquinhas e fale conosco para adotar com responsabilidade.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; gato?: string }>;
}) {
  const { token, gato } = await searchParams;
  const exclusiveToken = gato?.trim() ?? "";
  const phoneToken = token?.trim() ?? "";

  if (exclusiveToken) {
    const access = await getExclusiveCatForm(exclusiveToken);

    return (
      <SiteShell>
        {access.ok && access.cat ? (
          <AdoptionFlow
            token={exclusiveToken}
            exclusive
            lockedCat={access.cat}
          />
        ) : (
          <FormClosedNotice title={access.title} message={access.message} />
        )}
      </SiteShell>
    );
  }

  if (phoneToken) {
    const allowed = await getAdoptionFormAccess(phoneToken);

    return (
      <SiteShell>
        {allowed ? <AdoptionFlow token={phoneToken} /> : <FormClosedNotice />}
      </SiteShell>
    );
  }

  const { cats, raffles, vaquinhas } = await loadHomeCampaigns();

  return (
    <RecantoHome cats={cats} raffles={raffles} vaquinhas={vaquinhas} />
  );
}
