export function ProcessInfo() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-stone-900">
          Como funciona a adoção
        </h1>
        <p className="mt-2 text-base leading-relaxed text-stone-600">
          Leia com atenção e, se concordar, siga para o questionário.
        </p>
      </div>

      <ul className="space-y-3 text-base leading-relaxed text-stone-700">
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3 compact:px-2">
          Sua casa ou apartamento deve ser seguro, para que o gatinho não tenha
          acesso às ruas (janelas e muros telados).
        </li>
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3 compact:px-2">
          É preciso enviar um vídeo do local onde o gatinho terá acesso, pelo
          formulário ou pelo WhatsApp.
        </li>
        <li className="rounded-2xl bg-brand-bg/80 px-4 py-3 compact:px-2">
          É preciso assinar o termo de adoção responsável.
        </li>
      </ul>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-base leading-relaxed text-amber-950 compact:px-2">
        <p className="font-bold">
          Nossos gatinhos saem do abrigo castrados, vermifugados, com antipulgas
          e teste de FIV e FELV.
        </p>
        <p className="mt-1 text-sm font-medium leading-relaxed">
          Se houver suspeita de esporotricose, o gatinho fica em quarentena e só
          é liberado para adoção depois do teste.
        </p>
        <p className="mt-2">
          Repassamos ao tutor os custos que tivemos com a castração, vermífugos,
          antipulgas e possíveis testes clínicos.
        </p>
      </div>

      <p className="text-base font-semibold text-brand-950">
        Caso concorde, seguimos com o processo de adoção.
      </p>
    </section>
  );
}
