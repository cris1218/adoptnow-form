import { RecantoCatCard } from "@/components/RecantoCatCard";
import type { AvailableAdoptionCat } from "@/lib/availableCats";

export function RecantoCatsGallery({
  cats,
}: {
  cats: AvailableAdoptionCat[];
}) {
  if (cats.length === 0) {
    return (
      <div className="rounded-[1.75rem] border border-white/70 bg-white/90 px-5 py-8 text-center shadow-[0_18px_50px_rgba(14,90,88,0.12)] sm:px-8">
        <p className="text-base font-semibold text-stone-900">
          Nenhum gatinho listado no momento
        </p>
        <p className="mt-2 text-sm text-stone-600">
          Quando houver disponíveis para adoção, eles aparecem aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {cats.map((cat) => (
        <RecantoCatCard key={cat.id} cat={cat} />
      ))}
    </div>
  );
}
