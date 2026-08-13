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
  agreedToResponsibilityTerm: boolean;
  agreedHomeSafe: boolean;
  willSendVideoWhatsapp: boolean;
  homeVideoUrl: string;
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

const DEFAULT_R2_PUBLIC =
  "https://pub-69fe052b8ea841d295431051a32c1c9d.r2.dev";

export function isFormVideoUrl(url: string): boolean {
  const base = (process.env.R2_PUBLIC_URL ?? DEFAULT_R2_PUBLIC).replace(
    /\/$/,
    ""
  );
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" && url.startsWith(`${base}/form-videos/`)
    );
  } catch {
    return false;
  }
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
  const agreedToResponsibilityTerm = parseCheckbox(
    formData.get("agreedToResponsibilityTerm")
  );
  const agreedHomeSafe = parseCheckbox(formData.get("agreedHomeSafe"));
  const willSendVideoWhatsapp = parseCheckbox(
    formData.get("willSendVideoWhatsapp")
  );
  const homeVideoUrl = String(formData.get("homeVideoUrl") ?? "").trim();

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

  if (!agreedToResponsibilityTerm) {
    return {
      error:
        "É preciso confirmar que você está ciente de que vai assinar o termo de responsabilidade na hora da adoção.",
    };
  }

  if (!agreedHomeSafe) {
    return {
      error: "Marque que a residência é segura para a adoção.",
    };
  }

  if (!willSendVideoWhatsapp && !isFormVideoUrl(homeVideoUrl)) {
    return { error: "Envie o vídeo do local (até 1 minuto) ou marque que vai enviar pelo WhatsApp." };
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
      agreedToResponsibilityTerm,
      agreedHomeSafe,
      willSendVideoWhatsapp,
      homeVideoUrl: willSendVideoWhatsapp ? "" : homeVideoUrl,
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
    agreed_to_responsibility_term: answers.agreedToResponsibilityTerm,
    agreed_home_safe: answers.agreedHomeSafe,
    home_video_via_whatsapp: answers.willSendVideoWhatsapp,
    home_video_url: answers.willSendVideoWhatsapp ? "" : answers.homeVideoUrl,
    status: "novo",
    source: "form_web",
  };
}
