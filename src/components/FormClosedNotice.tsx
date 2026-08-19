import { PawMark } from "@/components/PawMark";
import { maskPhone } from "@/lib/masks";

const CONTACT_WHATSAPP = "42999007638";
const CONTACT_WHATSAPP_LINK = `https://wa.me/55${CONTACT_WHATSAPP}`;

export function FormClosedNotice() {
  return (
    <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
      <div className="flex flex-col items-center px-2 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark text-white">
          <PawMark className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-900">
          Formulário indisponível
        </h2>
        <p className="mt-3 max-w-sm text-base leading-relaxed text-stone-600">
          Entre em contato com o Recanto do Ron Ron pelo WhatsApp.
        </p>
        <a
          href={CONTACT_WHATSAPP_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 flex h-14 w-full max-w-sm items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition hover:bg-brand-950"
        >
          WhatsApp {maskPhone(CONTACT_WHATSAPP)}
        </a>
      </div>
    </section>
  );
}
