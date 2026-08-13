import { AdoptionLeadForm } from "@/components/AdoptionLeadForm";
import { PawMark } from "@/components/PawMark";
import { ProcessInfo } from "@/components/ProcessInfo";

export default function Home() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-x-hidden bg-brand-bg">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 right-[-4rem] h-64 w-64 rounded-full bg-brand-light/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[28rem] left-[-5rem] h-72 w-72 rounded-full bg-brand-dark/15 blur-3xl"
      />

      <header className="relative z-10 px-5 compact:px-2.5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div className="mx-auto flex max-w-lg items-center gap-3 pt-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-dark text-white shadow-sm">
            <PawMark className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-dark">
              Recanto do Ron Ron
            </p>
            <p className="text-sm text-stone-600">Adoção responsável</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-5 py-6 compact:px-2.5">
        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
          <ProcessInfo />
        </section>

        <section className="rounded-[1.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_18px_50px_rgba(14,90,88,0.12)] backdrop-blur-sm compact:px-3">
          <AdoptionLeadForm />
        </section>
      </main>

      <footer className="relative z-10 px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-center compact:px-2.5">
        <p className="pb-4 text-xs text-stone-500">
          Recanto do Ron Ron · seus dados são usados só para o processo de
          adoção
        </p>
      </footer>
    </div>
  );
}
