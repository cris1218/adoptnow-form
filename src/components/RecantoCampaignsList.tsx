import { PawMark } from "@/components/PawMark";
import {
  homeProgressPercent,
  type HomeRaffleCard,
  type HomeVaquinhaCard,
} from "@/lib/home";
import { formatCentsBrl } from "@/lib/vaquinhas";

function CardImage({ urls, alt }: { urls: string[]; alt: string }) {
  const src = urls[0]?.trim() ?? "";
  if (!src) {
    return (
      <div className="flex aspect-[16/10] w-full items-center justify-center bg-brand-bg text-brand-dark">
        <PawMark className="h-10 w-10 opacity-70" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="aspect-[16/10] w-full object-cover"
    />
  );
}

export function RecantoCampaignsList({
  raffles,
  vaquinhas,
}: {
  raffles: HomeRaffleCard[];
  vaquinhas: HomeVaquinhaCard[];
}) {
  if (raffles.length === 0 && vaquinhas.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 px-5 py-8 text-center shadow-[0_18px_50px_rgba(14,90,88,0.12)] sm:px-8">
        <p className="text-base font-semibold text-stone-900">
          Nenhuma campanha aberta no momento
        </p>
        <p className="mt-2 text-sm text-stone-600">
          Quando houver rifa ou vaquinha, elas aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {raffles.length > 0 ? (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-dark">
            Rifas
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {raffles.map((raffle) => (
              <a
                key={raffle.id}
                href={`/rifa?token=${encodeURIComponent(raffle.publicToken)}`}
                className="group overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_14px_40px_rgba(14,90,88,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(14,90,88,0.16)]"
              >
                <CardImage urls={raffle.photoUrls} alt={raffle.title} />
                <div className="space-y-2 p-4">
                  <p className="text-lg font-bold tracking-tight text-stone-900">
                    {raffle.title}
                  </p>
                  {raffle.itemsDescription ? (
                    <p className="line-clamp-2 text-sm leading-relaxed text-stone-600">
                      {raffle.itemsDescription}
                    </p>
                  ) : null}
                  <p className="text-sm font-semibold text-brand-dark">
                    {formatCentsBrl(raffle.priceCents)} por número
                  </p>
                  <span className="inline-flex text-sm font-semibold text-stone-800 group-hover:text-brand-950">
                    Participar →
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      ) : null}

      {vaquinhas.length > 0 ? (
        <div>
          <h2 className="text-sm font-bold uppercase tracking-[0.14em] text-brand-dark">
            Vaquinhas
          </h2>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vaquinhas.map((vaquinha) => {
              const percent = homeProgressPercent(
                vaquinha.raisedCents,
                vaquinha.goalCents
              );
              return (
                <a
                  key={vaquinha.id}
                  href={`/vaquinha?token=${encodeURIComponent(vaquinha.publicToken)}`}
                  className="group overflow-hidden rounded-[1.5rem] border border-white/70 bg-white/95 shadow-[0_14px_40px_rgba(14,90,88,0.1)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_50px_rgba(14,90,88,0.16)]"
                >
                  <CardImage
                    urls={vaquinha.photoUrls}
                    alt={vaquinha.title}
                  />
                  <div className="space-y-2 p-4">
                    <p className="text-lg font-bold tracking-tight text-stone-900">
                      {vaquinha.title}
                    </p>
                    {vaquinha.description ? (
                      <p className="line-clamp-2 text-sm leading-relaxed text-stone-600">
                        {vaquinha.description}
                      </p>
                    ) : null}
                    <div className="space-y-1.5">
                      <div className="flex items-end justify-between gap-2 text-sm">
                        <span className="font-semibold text-stone-900">
                          {formatCentsBrl(vaquinha.raisedCents)}
                          <span className="font-normal text-stone-500">
                            {" "}
                            de {formatCentsBrl(vaquinha.goalCents)}
                          </span>
                        </span>
                        <span className="font-semibold text-brand-dark">
                          {percent}%
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                        <div
                          className="h-full rounded-full bg-brand-dark"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                    <span className="inline-flex text-sm font-semibold text-stone-800 group-hover:text-brand-950">
                      Doar →
                    </span>
                  </div>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
