import Link from "next/link";

import { RecantoCatCard } from "@/components/RecantoCatCard";
import { RecantoSiteChrome } from "@/components/RecantoSiteChrome";
import type { AvailableAdoptionCat } from "@/lib/availableCats";
import {
  homeProgressPercent,
  type HomeRaffleCard,
  type HomeVaquinhaCard,
} from "@/lib/home";
import { CONTACT_WHATSAPP_LINK } from "@/lib/recantoContact";
import { formatCentsBrl } from "@/lib/vaquinhas";

export function RecantoHome({
  cats,
  raffles,
  vaquinhas,
}: {
  cats: AvailableAdoptionCat[];
  raffles: HomeRaffleCard[];
  vaquinhas: HomeVaquinhaCard[];
}) {
  const previewCats = cats.slice(0, 4);
  const previewRaffle = raffles[0] ?? null;
  const previewVaquinha = vaquinhas[0] ?? null;

  return (
    <RecantoSiteChrome>
      <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)] sm:p-8 lg:grid lg:grid-cols-[1.2fr_0.8fr] lg:gap-10 lg:p-10">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
            Abrigo de gatos
          </p>
          <h1 className="mt-2 text-[1.75rem] font-extrabold leading-tight tracking-tight text-stone-900 sm:text-4xl lg:text-5xl">
            Cuidado, resgate e um lar responsável para cada gatinho
          </h1>
          <p className="mt-3 text-base leading-relaxed text-stone-600 sm:text-lg">
            O Recanto do Ron Ron acolhe gatos, promove adoções responsáveis e
            conta com a ajuda da comunidade em rifas e vaquinhas para manter
            castração, exames e cuidados do dia a dia.
          </p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <a
              href={CONTACT_WHATSAPP_LINK}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-12 items-center justify-center rounded-2xl bg-brand-dark px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-950"
            >
              Falar no WhatsApp
            </a>
            <Link
              href="/gatinhos"
              className="flex h-12 items-center justify-center rounded-2xl border border-brand-dark px-5 text-base font-semibold text-brand-dark transition hover:bg-brand-bg"
            >
              Ver gatinhos
            </Link>
            <Link
              href="/campanhas"
              className="flex h-12 items-center justify-center rounded-2xl border border-stone-300 px-5 text-base font-semibold text-stone-800 transition hover:bg-stone-50"
            >
              Ver campanhas
            </Link>
          </div>
        </div>
        <div className="mt-6 space-y-3 lg:mt-0">
          <div className="rounded-2xl bg-brand-bg/90 px-4 py-3 text-sm leading-relaxed text-stone-700 sm:text-base">
            Gatinhos saem castrados, vermifugados, com antipulgas e teste de
            FIV/FeLV.
          </div>
          <div className="rounded-2xl bg-brand-bg/90 px-4 py-3 text-sm leading-relaxed text-stone-700 sm:text-base">
            Adoção exige casa segura (telas) e termo de adoção responsável.
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 sm:text-base">
            O formulário de adoção é enviado por link exclusivo. Sem link, fale
            conosco pelo WhatsApp.
          </div>
        </div>
      </section>

      <section className="mt-8 sm:mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
              Gatinhos
            </h2>
            <p className="mt-1 text-sm text-stone-600 sm:text-base">
              Disponíveis para adoção.
            </p>
          </div>
          <Link
            href="/gatinhos"
            className="shrink-0 text-sm font-semibold text-brand-dark hover:text-brand-950"
          >
            Ver todos →
          </Link>
        </div>
        {previewCats.length === 0 ? (
          <p className="mt-4 text-sm text-stone-600">
            Nenhum gatinho listado no momento.
          </p>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
            {previewCats.map((cat) => (
              <RecantoCatCard key={cat.id} cat={cat} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-8 sm:mt-12">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
              Campanhas
            </h2>
            <p className="mt-1 text-sm text-stone-600 sm:text-base">
              Rifas e vaquinhas abertas.
            </p>
          </div>
          <Link
            href="/campanhas"
            className="shrink-0 text-sm font-semibold text-brand-dark hover:text-brand-950"
          >
            Ver todas →
          </Link>
        </div>
        {previewRaffle || previewVaquinha ? (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {previewRaffle ? (
              <a
                href={`/rifa?token=${encodeURIComponent(previewRaffle.publicToken)}`}
                className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_14px_40px_rgba(14,90,88,0.1)]"
              >
                {previewRaffle.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewRaffle.photoUrls[0]}
                    alt={previewRaffle.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-1 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-dark">
                    Rifa
                  </p>
                  <p className="text-lg font-bold text-stone-900">
                    {previewRaffle.title}
                  </p>
                  <p className="text-sm font-semibold text-brand-dark">
                    {formatCentsBrl(previewRaffle.priceCents)} por número
                  </p>
                </div>
              </a>
            ) : null}
            {previewVaquinha ? (
              <a
                href={`/vaquinha?token=${encodeURIComponent(previewVaquinha.publicToken)}`}
                className="overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_14px_40px_rgba(14,90,88,0.1)]"
              >
                {previewVaquinha.photoUrls[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewVaquinha.photoUrls[0]}
                    alt={previewVaquinha.title}
                    className="aspect-[16/10] w-full object-cover"
                  />
                ) : null}
                <div className="space-y-2 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand-dark">
                    Vaquinha
                  </p>
                  <p className="text-lg font-bold text-stone-900">
                    {previewVaquinha.title}
                  </p>
                  <p className="text-sm text-stone-700">
                    {formatCentsBrl(previewVaquinha.raisedCents)} de{" "}
                    {formatCentsBrl(previewVaquinha.goalCents)} ·{" "}
                    {homeProgressPercent(
                      previewVaquinha.raisedCents,
                      previewVaquinha.goalCents
                    )}
                    %
                  </p>
                </div>
              </a>
            ) : null}
          </div>
        ) : (
          <p className="mt-4 text-sm text-stone-600">
            Nenhuma campanha aberta no momento.
          </p>
        )}
      </section>

      <section className="mt-8 rounded-[1.75rem] border border-white/70 bg-white/90 p-5 shadow-[0_18px_50px_rgba(14,90,88,0.12)] sm:mt-12 sm:p-8">
        <h2 className="text-xl font-extrabold tracking-tight text-stone-900 sm:text-2xl">
          Quer adotar?
        </h2>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-stone-600">
          Escolha um gatinho na galeria ou fale conosco pelo WhatsApp. O
          questionário de adoção é liberado por link enviado pelo Recanto.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/gatinhos"
            className="flex h-12 items-center justify-center rounded-2xl bg-brand-dark px-5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-950"
          >
            Ver gatinhos
          </Link>
          <a
            href={CONTACT_WHATSAPP_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-12 items-center justify-center rounded-2xl border border-brand-dark px-5 text-base font-semibold text-brand-dark transition hover:bg-brand-bg"
          >
            Falar no WhatsApp
          </a>
        </div>
      </section>
    </RecantoSiteChrome>
  );
}
