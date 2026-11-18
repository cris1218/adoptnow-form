import { FormClosedNotice } from "@/components/FormClosedNotice";
import { SiteShell } from "@/components/SiteShell";
import { loadVaquinhaPublic } from "@/app/vaquinha/actions";
import { VaquinhaClient } from "@/app/vaquinha/VaquinhaClient";

export default async function VaquinhaPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token: rawToken } = await searchParams;
  const token = rawToken?.trim() ?? "";

  if (!token) {
    return (
      <SiteShell title="Vaquinha">
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
      <SiteShell title="Vaquinha">
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
    <SiteShell eyebrow="Recanto do Ron Ron" title="Vaquinha">
      <VaquinhaClient token={token} initialVaquinha={access.vaquinha} />
    </SiteShell>
  );
}
