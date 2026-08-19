import { AdoptionFlow } from "@/components/AdoptionFlow";
import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { getAdoptionFormAccess } from "@/app/actions";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const trimmed = token?.trim() ?? "";
  const allowed = trimmed ? await getAdoptionFormAccess(trimmed) : false;

  return (
    <SiteShell>
      {allowed ? <AdoptionFlow token={trimmed} /> : <FormClosedNotice />}
    </SiteShell>
  );
}
