"use client";

import { useActionState, useEffect, useState } from "react";

import {
  loadAvailableAdoptionCats,
  savePotentialAdopter,
  type FormState,
} from "@/app/actions";
import { ChoiceGroup, Question, RequiredValue, ToggleChip } from "@/components/FormFields";
import { HomeVideoField } from "@/components/HomeVideoField";
import { PawMark } from "@/components/PawMark";
import { SelectedCatPreview } from "@/components/SelectedCatPreview";
import {
  formatCatSex,
  type AvailableAdoptionCat,
} from "@/lib/availableCats";
import { maskPhone } from "@/lib/masks";
import {
  INTERESTED_CAT_OTHER,
  type HomeType,
  type SexPreference,
} from "@/lib/questionnaire";

const initialState: FormState = null;

const yesNo = [
  { value: "sim", label: "Sim" },
  { value: "nao", label: "Não" },
] as const;

export function AdoptionLeadForm() {
  const [state, action, pending] = useActionState(
    savePotentialAdopter,
    initialState
  );
  const [phone, setPhone] = useState("");
  const [availableCats, setAvailableCats] = useState<AvailableAdoptionCat[]>(
    []
  );
  const [loadingCats, setLoadingCats] = useState(true);
  const [interestedCatId, setInterestedCatId] = useState("");
  const [otherCatName, setOtherCatName] = useState("");
  const [neverHadAnimals, setNeverHadAnimals] = useState(false);
  const [hadCats, setHadCats] = useState(false);
  const [hadDogs, setHadDogs] = useState(false);
  const [allNeutered, setAllNeutered] = useState<"sim" | "nao" | "">("");
  const [stillAlive, setStillAlive] = useState<"sim" | "nao" | "">("");
  const [homeSafe, setHomeSafe] = useState<"sim" | "nao" | "">("");
  const [hasWindowScreens, setHasWindowScreens] = useState<"sim" | "nao" | "">(
    ""
  );
  const [homeType, setHomeType] = useState<HomeType | "">("");
  const [wantsKitten, setWantsKitten] = useState(false);
  const [wantsAdult, setWantsAdult] = useState(false);
  const [sexPreference, setSexPreference] = useState<SexPreference | "">("");

  useEffect(() => {
    let cancelled = false;

    void loadAvailableAdoptionCats()
      .then((cats) => {
        if (!cancelled) setAvailableCats(cats);
      })
      .finally(() => {
        if (!cancelled) setLoadingCats(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const hadAnimals = hadCats || hadDogs;
  const selectedCat = availableCats.find((cat) => cat.id === interestedCatId);

  function selectNeverHad(next: boolean) {
    setNeverHadAnimals(next);
    if (next) {
      setHadCats(false);
      setHadDogs(false);
      setAllNeutered("");
      setStillAlive("");
    }
  }

  function selectHadCats(next: boolean) {
    setHadCats(next);
    if (next) setNeverHadAnimals(false);
  }

  function selectHadDogs(next: boolean) {
    setHadDogs(next);
    if (next) setNeverHadAnimals(false);
  }

  if (state?.ok) {
    return (
      <section className="flex flex-col items-center px-2 py-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-dark text-white">
          <svg
            viewBox="0 0 24 24"
            className="h-8 w-8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            aria-hidden="true"
          >
            <path
              d="M5 12.5 9.5 17 19 7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-bold tracking-tight text-stone-900">
          Recebemos seu questionário
        </h2>
        <p className="mt-2 max-w-sm text-base leading-relaxed text-stone-600">
          {state.message}
        </p>
        <PawMark className="mt-8 h-10 w-10 text-brand-light/70" />
      </section>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-5"
      onInvalid={(event) => {
        const field = event.target as HTMLElement;
        field
          .closest("section, label, div")
          ?.scrollIntoView({ behavior: "smooth", block: "center" });
      }}
    >
      <label className="sr-only" htmlFor="company">
        Empresa
      </label>
      <input
        id="company"
        name="company"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] h-0 w-0 opacity-0"
      />

      <div>
        <label
          htmlFor="fullName"
          className="mb-2 block text-sm font-semibold text-stone-700"
        >
          Seu nome
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          autoCapitalize="words"
          autoCorrect="off"
          placeholder="Nome e sobrenome"
          className="h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
        />
      </div>

      <div>
        <label
          htmlFor="phone"
          className="mb-2 block text-sm font-semibold text-stone-700"
        >
          WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          required
          autoComplete="tel-national"
          placeholder="(51) 99999-0000"
          value={phone}
          onChange={(event) => setPhone(maskPhone(event.target.value))}
          className="h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
        />
      </div>

      <div>
        <label
          htmlFor="interestedCatId"
          className="mb-2 block text-sm font-semibold text-stone-700"
        >
          Qual gatinho tem interesse?
        </label>
        <div className="relative">
          <select
            id="interestedCatId"
            name="interestedCatId"
            required={!loadingCats}
            disabled={loadingCats}
            value={interestedCatId}
            onChange={(event) => setInterestedCatId(event.target.value)}
            className="h-14 w-full appearance-none rounded-2xl border border-stone-300 bg-white px-4 pr-12 text-base text-stone-900 outline-none ring-brand-light focus:border-brand-light focus:ring-2 disabled:text-stone-400"
          >
            <option value="">
              {loadingCats ? "Carregando gatinhos..." : "Selecione o gatinho"}
            </option>
            {availableCats.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
                {cat.sex ? ` (${formatCatSex(cat.sex)})` : ""}
                {cat.quarantineReleasedAt ? " · quarentena" : ""}
              </option>
            ))}
            <option value={INTERESTED_CAT_OTHER}>Outros</option>
          </select>
          <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-stone-500">
            <svg
              viewBox="0 0 20 20"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                d="M6 8l4 4 4-4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </div>
        {interestedCatId === INTERESTED_CAT_OTHER ? (
          <input
            id="interestedCatOtherName"
            name="interestedCatOtherName"
            type="text"
            required
            minLength={2}
            maxLength={80}
            autoCapitalize="words"
            autoCorrect="off"
            placeholder="Qual o nome do gatinho?"
            value={otherCatName}
            onChange={(event) => setOtherCatName(event.target.value)}
            className="mt-3 h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
          />
        ) : (
          <input
            type="hidden"
            name="interestedCatName"
            value={
              availableCats.find((cat) => cat.id === interestedCatId)?.name ??
              ""
            }
          />
        )}
        {selectedCat ? (
          <SelectedCatPreview key={selectedCat.id} cat={selectedCat} />
        ) : null}
      </div>

      <h2 className="pt-2 text-xl font-extrabold text-stone-900">Questionário</h2>

      <Question number={1} title="Já teve animais?">
        <RequiredValue
          filled={neverHadAnimals || hadCats || hadDogs}
          message="Informe se já teve gatos, cães, ou se nunca teve animais."
        />
        <div className="grid grid-cols-2 gap-2">
          <ToggleChip name="hadCats" checked={hadCats} onChange={selectHadCats}>
            Gatos
          </ToggleChip>
          <ToggleChip name="hadDogs" checked={hadDogs} onChange={selectHadDogs}>
            Cães
          </ToggleChip>
        </div>
        <div className="mt-2">
          <ToggleChip
            name="neverHadAnimals"
            checked={neverHadAnimals}
            onChange={selectNeverHad}
          >
            Nunca tive
          </ToggleChip>
        </div>
        {hadAnimals ? (
          <div className="mt-3">
            <label
              htmlFor="animalsCount"
              className="mb-2 block text-sm font-semibold text-stone-700"
            >
              Quantos?
            </label>
            <input
              id="animalsCount"
              name="animalsCount"
              type="number"
              inputMode="numeric"
              min={1}
              max={99}
              required
              placeholder="0"
              className="h-14 w-full rounded-2xl border border-stone-300 bg-white px-4 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
            />
          </div>
        ) : null}
      </Question>

      {hadAnimals ? (
        <>
          <Question number={2} title="Eram todos castrados?">
            <ChoiceGroup
              name="allNeutered"
              value={allNeutered}
              onChange={setAllNeutered}
              options={yesNo}
            />
          </Question>

          <Question number={3} title="Ainda estão vivos?">
            <ChoiceGroup
              name="stillAlive"
              value={stillAlive}
              onChange={setStillAlive}
              options={yesNo}
            />
            {stillAlive === "nao" ? (
              <div className="mt-3">
                <label
                  htmlFor="deathReason"
                  className="mb-2 block text-sm font-semibold text-stone-700"
                >
                  Se morreu, qual foi o motivo?
                </label>
                <textarea
                  id="deathReason"
                  name="deathReason"
                  required
                  rows={3}
                  placeholder="Conte o que aconteceu"
                  className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
                />
              </div>
            ) : null}
          </Question>
        </>
      ) : null}

      <Question number={4} title="O lar é seguro?">
        <ChoiceGroup
          name="homeSafe"
          value={homeSafe}
          onChange={setHomeSafe}
          options={yesNo}
        />
      </Question>

      <Question number={5} title="Tem telas nas janelas?">
        <ChoiceGroup
          name="hasWindowScreens"
          value={hasWindowScreens}
          onChange={setHasWindowScreens}
          options={yesNo}
        />
      </Question>

      <HomeVideoField />

      <Question
        number={6}
        title="É casa ou apartamento?"
        hint="Janelas ou gradil precisam ser telados, muros altos e portões chapeados, para o gatinho não ter acesso à rua."
      >
        <ChoiceGroup
          name="homeType"
          value={homeType}
          onChange={setHomeType}
          options={[
            { value: "casa", label: "Casa" },
            { value: "apartamento", label: "Apartamento" },
          ]}
        />
      </Question>

      <Question number={7} title="Você deseja adotar?">
        <RequiredValue
          filled={wantsKitten || wantsAdult}
          message="Informe se deseja adotar filhote, adulto ou ambos."
        />
        <div className="grid grid-cols-2 gap-2">
          <ToggleChip
            name="wantsKitten"
            checked={wantsKitten}
            onChange={setWantsKitten}
          >
            Filhote
          </ToggleChip>
          <ToggleChip
            name="wantsAdult"
            checked={wantsAdult}
            onChange={setWantsAdult}
          >
            Adulto
          </ToggleChip>
        </div>
      </Question>

      <Question number={8} title="Tem preferência de sexo? Por quê?">
        <ChoiceGroup
          name="sexPreference"
          value={sexPreference}
          onChange={setSexPreference}
          options={[
            { value: "femea", label: "Fêmea" },
            { value: "macho", label: "Macho" },
            { value: "indiferente", label: "Tanto faz" },
          ]}
          columns={3}
        />
        {sexPreference && sexPreference !== "indiferente" ? (
          <div className="mt-3">
            <label
              htmlFor="sexPreferenceReason"
              className="mb-2 block text-sm font-semibold text-stone-700"
            >
              Por quê?
            </label>
            <textarea
              id="sexPreferenceReason"
              name="sexPreferenceReason"
              required
              rows={3}
              placeholder="Conte o motivo da preferência"
              className="w-full rounded-2xl border border-stone-300 bg-white px-4 py-3 text-base text-stone-900 outline-none ring-brand-light placeholder:text-stone-400 focus:border-brand-light focus:ring-2"
            />
          </div>
        ) : null}
      </Question>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-950 compact:px-2">
        Todo tutor deve ter condições de manter um animal, com ração, areia e
        cuidados veterinários. Não é preciso ser rico, mas é fundamental ter
        recursos para as despesas, principalmente se precisar de atendimento
        veterinário.
      </div>

      <label className="flex gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
        <input
          type="checkbox"
          name="agreedToProcess"
          value="true"
          required
          className="mt-1 h-5 w-5 shrink-0 accent-[#148B87]"
        />
        <span className="text-sm leading-relaxed text-stone-700">
          Li as regras e concordo em seguir: lar seguro com telas, envio do
          vídeo do local e o repasse dos custos de castração, vermífugo,
          antipulgas e possíveis testes clínicos.
        </span>
      </label>

      <label className="flex gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
        <input
          type="checkbox"
          name="agreedToCosts"
          value="true"
          required
          className="mt-1 h-5 w-5 shrink-0 accent-[#148B87]"
        />
        <span className="text-sm leading-relaxed text-stone-700">
          Tenho condições de arcar com ração, areia e cuidados veterinários do
          gatinho.
        </span>
      </label>

      <label className="flex gap-3 rounded-2xl border border-stone-300 bg-white p-4 compact:px-2">
        <input
          type="checkbox"
          name="agreedToResponsibilityTerm"
          value="true"
          required
          className="mt-1 h-5 w-5 shrink-0 accent-[#148B87]"
        />
        <span className="text-sm leading-relaxed text-stone-700">
          Estou ciente de que, na hora da adoção, vou assinar um termo de
          responsabilidade.
        </span>
      </label>

      {state && !state.ok ? (
        <p
          role="alert"
          className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700"
        >
          {state.message}
        </p>
      ) : null}

      <div className="sticky bottom-0 -mx-6 mt-1 border-t border-stone-200 bg-white/95 px-6 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm compact:-mx-3 compact:px-3">
        <button
          type="submit"
          disabled={pending || loadingCats}
          className="flex h-14 w-full items-center justify-center rounded-2xl bg-brand-dark text-lg font-semibold text-white shadow-sm transition active:scale-[0.99] enabled:hover:bg-brand-950 disabled:opacity-60"
        >
          {pending
            ? "Enviando..."
            : loadingCats
              ? "Carregando..."
              : "Enviar questionário"}
        </button>
      </div>
    </form>
  );
}
