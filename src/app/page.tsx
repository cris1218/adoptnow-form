import { AdoptionFlow } from "@/components/AdoptionFlow";
import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { getAdoptionFormAccess, getExclusiveCatForm } from "@/app/actions";

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
          <FormClosedNotice message={access.message} />
        )}
      </SiteShell>
    );
  }

  const allowed = phoneToken ? await getAdoptionFormAccess(phoneToken) : false;

  return (
    <SiteShell>
      {allowed ? <AdoptionFlow token={phoneToken} /> : <FormClosedNotice />}
    </SiteShell>
  );
}
