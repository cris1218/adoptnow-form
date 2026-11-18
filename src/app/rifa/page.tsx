import type { Metadata } from "next";

import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { loadRafflePublic } from "@/app/rifa/actions";
import { RaffleClient } from "@/app/rifa/RaffleClient";

const PAGE_LABEL = "Rifa";
const SITE_NAME = "Recanto do Ron Ron";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}): Promise<Metadata> {
  const token = (await searchParams).token?.trim() ?? "";
  if (!token) {
    return { title: `${PAGE_LABEL} | ${SITE_NAME}` };
  }

  const access = await loadRafflePublic(token);
  const raffleTitle = access.raffle?.title?.trim();
  if (access.ok && raffleTitle) {
    return { title: `${raffleTitle} | ${PAGE_LABEL}` };
  }

  return { title: `${PAGE_LABEL} | ${SITE_NAME}` };
}

export default async function RafflePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return (
      <SiteShell title={PAGE_LABEL}>
        <FormClosedNotice
          title="Link incompleto"
          message="Abra o link completo da rifa enviado pelo Recanto do Ron Ron."
        />
      </SiteShell>
    );
  }

  const access = await loadRafflePublic(token);

  if (!access.ok || !access.raffle || !access.numbers) {
    return (
      <SiteShell title={PAGE_LABEL}>
        <FormClosedNotice
          title="Rifa indisponível"
          message={access.message || "Entre em contato com o Recanto do Ron Ron."}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell eyebrow={SITE_NAME} title={PAGE_LABEL}>
      <RaffleClient
        token={token}
        initialRaffle={access.raffle}
        initialNumbers={access.numbers}
        initialWinners={access.winners ?? []}
      />
    </SiteShell>
  );
}
