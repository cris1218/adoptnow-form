export function ProcessInfo() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-stone-900">
          Como funciona a adoção
        </h1>
        <p className="mt-2 text-base leading-relaxed text-stone-600">
          Leia com atenção e, se concordar, responda o questionário no final.
        </p>
      </div>

      <ul className="space-y-3 text-base leading-relaxed text-stone-700">
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3">
          Sua casa ou apartamento deve ser seguro, para que o gatinho não tenha
          acesso às ruas (janelas e muros telados).
        </li>
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3">
          É preciso enviar um vídeo do local onde o gatinho terá acesso.
        </li>
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3">
          É preciso assinar o termo de adoção responsável.
        </li>
      </ul>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950">
        <p className="font-bold">Nossos gatinhos saem do abrigo castrados, vermifugados e com antipulgas.</p>
        <p className="mt-2">
          Repassamos ao tutor os custos que tivemos com a castração, vermífugos e
          antipulgas.
        </p>
      </div>

      <p className="text-base font-semibold text-brand-950">
        Caso concorde, seguimos com o processo de adoção.
      </p>
    </section>
  );
}
