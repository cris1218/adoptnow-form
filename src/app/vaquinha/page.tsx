import type { Metadata } from "next";

import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { loadVaquinhaPublic } from "@/app/vaquinha/actions";
import { VaquinhaClient } from "@/app/vaquinha/VaquinhaClient";

const PAGE_LABEL = "Vaquinha";
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

  const access = await loadVaquinhaPublic(token);
  const campaignTitle = access.vaquinha?.title?.trim();
  if (access.ok && campaignTitle) {
    return { title: `${campaignTitle} | ${PAGE_LABEL}` };
  }

  return { title: `${PAGE_LABEL} | ${SITE_NAME}` };
}

export default async function VaquinhaPage({
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
          message="Abra o link completo da vaquinha enviado pelo Recanto do Ron Ron."
        />
      </SiteShell>
    );
  }

  const access = await loadVaquinhaPublic(token);

  if (!access.ok || !access.vaquinha) {
    return (
      <SiteShell title={PAGE_LABEL}>
        <FormClosedNotice
          title="Vaquinha indisponível"
          message={
            access.message || "Entre em contato com o Recanto do Ron Ron."
          }
        />
      </SiteShell>
    );
  }

  return (
    <SiteShell eyebrow={SITE_NAME} title={PAGE_LABEL}>
      <VaquinhaClient token={token} initialVaquinha={access.vaquinha} />
    </SiteShell>
  );
}
