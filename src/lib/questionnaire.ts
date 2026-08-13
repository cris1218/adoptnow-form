export type HomeType = "casa" | "apartamento";
export type SexPreference = "femea" | "macho" | "indiferente";

export type AdoptionAnswers = {
  fullName: string;
  phone: string;
  neverHadAnimals: boolean;
  hadCats: boolean;
  hadDogs: boolean;
  animalsCount: number;
  allNeutered: boolean | null;
  stillAlive: boolean | null;
  deathReason: string;
  homeSafe: boolean;
  hasWindowScreens: boolean;
  homeType: HomeType;
  wantsKitten: boolean;
  wantsAdult: boolean;
  sexPreference: SexPreference;
  sexPreferenceReason: string;
  agreedToProcess: boolean;
  agreedToCosts: boolean;
};

export function parseYesNo(value: FormDataEntryValue | null): boolean | null {
  const raw = String(value ?? "").trim();
  if (raw === "sim") return true;
  if (raw === "nao") return false;
  return null;
}

export function parseHomeType(
  value: FormDataEntryValue | null
): HomeType | null {
  const raw = String(value ?? "").trim();
  if (raw === "casa" || raw === "apartamento") return raw;
  return null;
}

export function parseSexPreference(
  value: FormDataEntryValue | null
): SexPreference | null {
  const raw = String(value ?? "").trim();
  if (raw === "femea" || raw === "macho" || raw === "indiferente") return raw;
  return null;
}

export function parseCheckbox(value: FormDataEntryValue | null): boolean {
  return String(value ?? "") === "on" || String(value ?? "") === "true";
}

export function parseAnswers(
  formData: FormData,
  phone: string
): { answers?: AdoptionAnswers; error?: string } {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const neverHadAnimals = parseCheckbox(formData.get("neverHadAnimals"));
  const hadCats = parseCheckbox(formData.get("hadCats"));
  const hadDogs = parseCheckbox(formData.get("hadDogs"));
  const animalsCountRaw = String(formData.get("animalsCount") ?? "").trim();
  const animalsCount = animalsCountRaw ? Number.parseInt(animalsCountRaw, 10) : 0;
  const allNeutered = parseYesNo(formData.get("allNeutered"));
  const stillAlive = parseYesNo(formData.get("stillAlive"));
  const deathReason = String(formData.get("deathReason") ?? "").trim();
  const homeSafe = parseYesNo(formData.get("homeSafe"));
  const hasWindowScreens = parseYesNo(formData.get("hasWindowScreens"));
  const homeType = parseHomeType(formData.get("homeType"));
  const wantsKitten = parseCheckbox(formData.get("wantsKitten"));
  const wantsAdult = parseCheckbox(formData.get("wantsAdult"));
  const sexPreference = parseSexPreference(formData.get("sexPreference"));
  const sexPreferenceReason = String(
    formData.get("sexPreferenceReason") ?? ""
  ).trim();
  const agreedToProcess = parseCheckbox(formData.get("agreedToProcess"));
  const agreedToCosts = parseCheckbox(formData.get("agreedToCosts"));

  if (fullName.length < 2 || fullName.length > 120) {
    return { error: "Informe seu nome completo." };
  }

  if (!neverHadAnimals && !hadCats && !hadDogs) {
    return { error: "Informe se já teve gatos, cães, ou se nunca teve animais." };
  }

  if (!neverHadAnimals) {
    if (!Number.isFinite(animalsCount) || animalsCount < 1) {
      return { error: "Informe quantos animais você já teve." };
    }

    if (allNeutered === null) {
      return { error: "Informe se os animais eram todos castrados." };
    }

    if (stillAlive === null) {
      return { error: "Informe se os animais ainda estão vivos." };
    }

    if (stillAlive === false && deathReason.length < 2) {
      return { error: "Conte o motivo da perda do animal." };
    }
  }

  if (homeSafe === null) {
    return { error: "Informe se o lar é seguro." };
  }

  if (hasWindowScreens === null) {
    return { error: "Informe se há telas nas janelas." };
  }

  if (!homeType) {
    return { error: "Informe se é casa ou apartamento." };
  }

  if (!wantsKitten && !wantsAdult) {
    return { error: "Informe se deseja adotar filhote, adulto ou ambos." };
  }

  if (!sexPreference) {
    return { error: "Informe a preferência de sexo." };
  }

  if (sexPreference !== "indiferente" && sexPreferenceReason.length < 2) {
    return { error: "Conte por que você tem essa preferência de sexo." };
  }

  if (!agreedToProcess) {
    return { error: "É preciso concordar com o processo de adoção para continuar." };
  }

  if (!agreedToCosts) {
    return {
      error:
        "É preciso confirmar que você tem condições de manter o gatinho, inclusive com veterinário.",
    };
  }

  return {
    answers: {
      fullName,
      phone,
      neverHadAnimals,
      hadCats: neverHadAnimals ? false : hadCats,
      hadDogs: neverHadAnimals ? false : hadDogs,
      animalsCount: neverHadAnimals ? 0 : animalsCount,
      allNeutered: neverHadAnimals ? null : allNeutered,
      stillAlive: neverHadAnimals ? null : stillAlive,
      deathReason: neverHadAnimals || stillAlive !== false ? "" : deathReason,
      homeSafe,
      hasWindowScreens,
      homeType,
      wantsKitten,
      wantsAdult,
      sexPreference,
      sexPreferenceReason,
      agreedToProcess,
      agreedToCosts,
    },
  };
}

export function toInsertRow(answers: AdoptionAnswers) {
  return {
    full_name: answers.fullName,
    phone: answers.phone,
    never_had_animals: answers.neverHadAnimals,
    had_cats: answers.hadCats,
    had_dogs: answers.hadDogs,
    animals_count: answers.animalsCount,
    all_neutered: answers.allNeutered,
    still_alive: answers.stillAlive,
    death_reason: answers.deathReason,
    home_safe: answers.homeSafe,
    has_window_screens: answers.hasWindowScreens,
    home_type: answers.homeType,
    wants_kitten: answers.wantsKitten,
    wants_adult: answers.wantsAdult,
    sex_preference: answers.sexPreference,
    sex_preference_reason: answers.sexPreferenceReason,
    agreed_to_process: answers.agreedToProcess,
    agreed_to_costs: answers.agreedToCosts,
    status: "novo",
    source: "form_web",
  };
}
