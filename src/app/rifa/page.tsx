import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { loadRafflePublic } from "@/app/rifa/actions";
import { RaffleClient } from "@/app/rifa/RaffleClient";

export default async function RafflePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return (
      <SiteShell title="Rifa">
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
      <SiteShell title="Rifa">
        <FormClosedNotice
          title="Rifa indisponível"
          message={access.message || "Entre em contato com o Recanto do Ron Ron."}
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell eyebrow="Recanto do Ron Ron" title="Rifa">
      <RaffleClient
        token={token}
        initialRaffle={access.raffle}
        initialNumbers={access.numbers}
        initialWinners={access.winners ?? []}
      />
    </SiteShell>
  );
}
