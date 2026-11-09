"use server";

import {
  listAvailableAdoptionCats,
  type AvailableAdoptionCat,
} from "@/lib/availableCats";
import {
  DOCUMENT_NOT_RECOGNIZED_MESSAGE,
  verifiedDocumentCheck,
  verifyDocumentForForm,
  type DocumentCheckStatus,
  type DocumentPhotoVerification,
} from "@/lib/documentCheck";
import {
  identityAddressesEqual,
  isIdentityAddressComplete,
  normalizeIdentityAddress,
  type IdentityAddress,
} from "@/lib/identityAddress";
import { getSupabaseServer } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { isValidCpf, normalizePhone, onlyDigits, phoneError } from "@/lib/masks";
import {
  notifyStaffExclusiveCatInterest,
  notifyStaffKnownPersonAutoApproved,
  notifyStaffPotentialAdopter,
} from "@/lib/notifyStaff";
import { parseAnswers, toInsertRow } from "@/lib/questionnaire";

export type FormState = {
  ok: boolean;
  message: string;
} | null;

const CPF_PENDING_MESSAGE =
  "Este CPF já possui cadastro como interessado. Aguarde a avaliação da equipe do Recanto do Ron Ron.";

const CPF_APPROVED_MESSAGE =
  "Este CPF já foi aprovado. Aguarde que entraremos em contato.";

const CPF_DENIED_MESSAGE =
  "Já existe um cadastro de interesse com este CPF. Estamos avaliando e entraremos em contato.";

export type KnownFormPerson = {
  known: true;
  kind: "adopter" | "approved";
  adopterId: string | null;
  fullName: string;
  phone: string;
  document: string;
  documentPhotoUrl: string;
  documentCheckStatus: string;
  address: IdentityAddress;
};

export type LookupFormPersonByCpfResult =
  | { known: false }
  | KnownFormPerson;

type KnownPersonPayload = {
  known?: boolean;
  kind?: string;
  adopterId?: string | null;
  fullName?: string;
  phone?: string;
  document?: string;
  documentPhotoUrl?: string;
  documentCheckStatus?: string;
  address?: Partial<IdentityAddress> | null;
};

function mapKnownPerson(payload: KnownPersonPayload | null): LookupFormPersonByCpfResult {
  if (!payload?.known) return { known: false };

  const kind = payload.kind === "adopter" ? "adopter" : "approved";
  const address = normalizeIdentityAddress(payload.address ?? undefined);
  return {
    known: true,
    kind,
    adopterId:
      typeof payload.adopterId === "string" && payload.adopterId.trim()
        ? payload.adopterId.trim()
        : null,
    fullName: String(payload.fullName ?? "").trim(),
    phone: normalizePhone(String(payload.phone ?? "")),
    document: onlyDigits(String(payload.document ?? "")),
    documentPhotoUrl: String(payload.documentPhotoUrl ?? "").trim(),
    documentCheckStatus: String(payload.documentCheckStatus ?? "").trim(),
    address,
  };
}

export async function checkPotentialAdopterCpf(
  rawCpf: string,
  catId?: string
): Promise<{ blocked: boolean; message?: string }> {
  const cpf = onlyDigits(rawCpf);
  if (!isValidCpf(cpf)) {
    return { blocked: false };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc(
      "get_potential_adopter_cpf_status",
      {
        p_cpf: cpf,
        ...(catId ? { p_cat_id: catId } : {}),
      }
    );

    if (error) {
      console.error("Falha ao validar CPF do interessado:", error);
      return { blocked: false };
    }

    const status = typeof data === "string" ? data.trim() : "";
    if (status === "aprovado") {
      return { blocked: true, message: CPF_APPROVED_MESSAGE };
    }
    if (status === "pendente") {
      return { blocked: true, message: CPF_PENDING_MESSAGE };
    }
    if (status === "negado") {
      return { blocked: true, message: CPF_DENIED_MESSAGE };
    }

    return { blocked: false };
  } catch (error) {
    console.error("Falha ao validar CPF do interessado:", error);
    return { blocked: false };
  }
}

export async function lookupFormPersonByCpf(
  rawCpf: string
): Promise<LookupFormPersonByCpfResult> {
  const cpf = onlyDigits(rawCpf);
  if (!isValidCpf(cpf)) {
    return { known: false };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("lookup_form_person_by_cpf", {
      p_cpf: cpf,
    });

    if (error) {
      console.error("Falha ao buscar pessoa conhecida pelo CPF:", error);
      return { known: false };
    }

    return mapKnownPerson((data ?? null) as KnownPersonPayload | null);
  } catch (error) {
    console.error("Falha ao buscar pessoa conhecida pelo CPF:", error);
    return { known: false };
  }
}

/** @deprecated Use checkPotentialAdopterCpf. Mantido só se algum trecho antigo ainda importar. */
export async function checkPotentialAdopterPhone(
  rawPhone: string,
  catId?: string
): Promise<{ exists: boolean; message?: string }> {
  void rawPhone;
  void catId;
  return { exists: false };
}

export async function verifyLeadDocumentPhoto(
  accessToken: string,
  accessKind: string,
  documentPhotoUrl: string
): Promise<DocumentPhotoVerification> {
  const allowed =
    accessKind === "exclusive"
      ? (await getExclusiveCatForm(accessToken)).ok
      : await getAdoptionFormAccess(accessToken);
  if (!allowed) return { status: "nao_verificado", proof: "" };

  return verifyDocumentForForm(documentPhotoUrl.trim());
}

export async function savePotentialAdopter(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const honeypot = String(formData.get("company") ?? "").trim();
  if (honeypot) {
    return {
      ok: true,
      message: "Recebemos seu questionário. Em breve falamos com você.",
    };
  }

  const accessToken = String(formData.get("accessToken") ?? "").trim();
  const accessKind = String(formData.get("accessKind") ?? "phone");
  const exclusive = accessKind === "exclusive";
  if (!accessToken) {
    return {
      ok: false,
      message: "Entre em contato com o Recanto do Ron Ron.",
    };
  }

  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  const invalidPhone = phoneError(phone);
  if (invalidPhone) {
    return { ok: false, message: invalidPhone };
  }

  const cpf = onlyDigits(String(formData.get("document") ?? ""));
  if (!isValidCpf(cpf)) {
    return { ok: false, message: "Informe um CPF válido." };
  }

  const lockedCatId = String(formData.get("exclusiveCatId") ?? "").trim();
  const cpfCheck = await checkPotentialAdopterCpf(
    cpf,
    exclusive ? lockedCatId : undefined
  );
  if (cpfCheck.blocked) {
    return {
      ok: false,
      message: cpfCheck.message ?? CPF_PENDING_MESSAGE,
    };
  }

  const knownPerson = await lookupFormPersonByCpf(cpf);
  const known = knownPerson.known;
  const knownDocumentPhotoUrl = known
    ? knownPerson.documentPhotoUrl.trim()
    : "";
  const addressSame =
    known &&
    isIdentityAddressComplete(knownPerson.address) &&
    identityAddressesEqual(
      knownPerson.address,
      normalizeIdentityAddress({
        document: cpf,
        cep: String(formData.get("cep") ?? ""),
        street: String(formData.get("street") ?? ""),
        neighborhood: String(formData.get("neighborhood") ?? ""),
        number: String(formData.get("number") ?? ""),
        city: String(formData.get("city") ?? ""),
        state: String(formData.get("state") ?? ""),
      })
    );
  const skipDocumentPhoto = Boolean(knownDocumentPhotoUrl);
  const skipHomeVideo = known && addressSame;
  const autoApprove = known && addressSame;

  const parsed = parseAnswers(formData, phone, {
    requireDocumentPhoto: !skipDocumentPhoto,
    requireHomeVideo: !skipHomeVideo,
    knownDocumentPhotoUrl,
  });
  if (parsed.error || !parsed.answers) {
    return { ok: false, message: parsed.error ?? "Revise as respostas." };
  }

  if (onlyDigits(parsed.answers.identity.document) !== cpf) {
    return { ok: false, message: "Confira o CPF informado." };
  }

  let documentCheck: { status: DocumentCheckStatus; reason: string };
  if (skipDocumentPhoto) {
    documentCheck = {
      status: "verificado",
      reason: "cadastro_conhecido",
    };
  } else {
    const verified = verifiedDocumentCheck(
      parsed.answers.documentPhotoUrl,
      String(formData.get("documentCheckProof") ?? "").trim()
    );
    if (!verified) {
      return { ok: false, message: DOCUMENT_NOT_RECOGNIZED_MESSAGE };
    }
    documentCheck = verified;
  }

  try {
    const supabase = getSupabaseServer();
    let exclusiveCat: AvailableAdoptionCat | null = null;

    if (exclusive) {
      const exclusiveAccess = await getExclusiveCatForm(accessToken);
      if (!exclusiveAccess.ok || !exclusiveAccess.cat) {
        return {
          ok: false,
          message: exclusiveAccess.message,
        };
      }
      exclusiveCat = exclusiveAccess.cat;
    } else {
      const { data: access, error: accessError } = await supabase.rpc(
        "get_adoption_form_access",
        { p_token: accessToken }
      );

      if (accessError || !(access as { ok?: boolean } | null)?.ok) {
        return {
          ok: false,
          message: "Entre em contato com o Recanto do Ron Ron.",
        };
      }
    }

    const availableCats = exclusiveCat
      ? [exclusiveCat]
      : await listAvailableAdoptionCats(supabase);
    const requestedId = exclusiveCat?.id ?? parsed.answers.interestedCatId;
    const selectedCat = requestedId
      ? availableCats.find((cat) => cat.id === requestedId)
      : undefined;

    const typedOtherCat = !exclusive && parsed.answers.interestedCatOther;
    if (!typedOtherCat && !selectedCat) {
      return {
        ok: false,
        message: requestedId
          ? "Esse gatinho não está mais disponível. Escolha outro."
          : "Selecione o gatinho que tem interesse.",
      };
    }

    const answers = {
      ...parsed.answers,
      interestedCatId: exclusiveCat
        ? exclusiveCat.id
        : parsed.answers.interestedCatOther
          ? null
          : selectedCat?.id ?? null,
      interestedCatName: exclusiveCat
        ? exclusiveCat.name
        : parsed.answers.interestedCatOther
          ? parsed.answers.interestedCatName
          : selectedCat?.name ?? parsed.answers.interestedCatName,
      interestedCatOther: exclusiveCat ? false : parsed.answers.interestedCatOther,
    };

    const insertClient = getSupabaseAdmin() ?? supabase;

    if (insertClient === supabase) {
      console.warn(
        "SUPABASE_SERVICE_ROLE_KEY ausente; insert usa anon e depende da policy do formulário."
      );
    }

    const { error } = await insertClient
      .from("potential_adopters")
      .insert(toInsertRow(answers, documentCheck));

    if (error) {
      console.error("Erro ao salvar possível adotante:", error);
      const message = String(error.message ?? "");
      if (message.includes("Já está na lista") || message.includes("já está na lista")) {
        return { ok: false, message: CPF_APPROVED_MESSAGE };
      }
      if (message.includes("em análise")) {
        return { ok: false, message: CPF_PENDING_MESSAGE };
      }
      if (message.includes("Não é possível se cadastrar")) {
        return { ok: false, message: CPF_DENIED_MESSAGE };
      }
      if (
        message.includes("row-level security") ||
        message.includes("permission denied")
      ) {
        return {
          ok: false,
          message:
            "Não foi possível salvar o cadastro. Confira o vídeo do lar (ou a opção de enviar pelo WhatsApp) e tente de novo.",
        };
      }
      return {
        ok: false,
        message: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    if (!exclusive) {
      const { data: consumed, error: consumeError } = await supabase.rpc(
        "consume_adoption_form_token",
        { p_token: accessToken }
      );

      if (consumeError || !(consumed as { ok?: boolean } | null)?.ok) {
        console.error("Falha ao invalidar o token do formulário:", consumeError);
      }
    }

    try {
      if (autoApprove) {
        await notifyStaffKnownPersonAutoApproved(
          parsed.answers.fullName,
          answers.interestedCatName
        );
      } else if (exclusive) {
        await notifyStaffExclusiveCatInterest(
          parsed.answers.fullName,
          answers.interestedCatName,
          documentCheck.status
        );
      } else {
        await notifyStaffPotentialAdopter(
          parsed.answers.fullName,
          answers.interestedCatName,
          documentCheck.status
        );
      }
    } catch (pushError) {
      console.error("Falha ao notificar a equipe:", pushError);
    }

    return {
      ok: true,
      message: autoApprove
        ? "Recebemos seu interesse. Como seu cadastro já era conhecido e o endereço é o mesmo, você já ficou aprovado. Em breve falamos pelo WhatsApp."
        : "Obrigada pelo interesse. A equipe do Recanto do Ron Ron entra em contato pelo WhatsApp.",
    };
  } catch (error) {
    console.error("Erro inesperado ao salvar possível adotante:", error);
    return {
      ok: false,
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }
}

type ExclusiveCatFormPayload = {
  ok?: boolean;
  reason?: string;
  message?: string;
  cat?: {
    id?: string;
    name?: string;
    sex?: string;
    fur_color?: string;
    birth_date_approx?: string | null;
    photo_url?: string | null;
    quarantine_released_at?: string | null;
    fiv?: string;
    felv?: string;
  } | null;
};

const EXCLUSIVE_NOT_STARTED_MESSAGE =
  "Este formulário ainda não está aberto. Aguarde a data de início ou entre em contato com o Recanto do Ron Ron.";

const EXCLUSIVE_GENERIC_CLOSED_MESSAGE =
  "Entre em contato com o Recanto do Ron Ron pelo WhatsApp.";

function exclusiveFoundHomeMessage(catName: string): string {
  return `${catName} não está mais para adoção. Já encontrou um lar. Aguarde a próxima lista ou entre em contato com o Recanto do Ron Ron.`;
}

function exclusiveClosedNotice(payload: ExclusiveCatFormPayload | null): {
  title: string;
  message: string;
} {
  const catName = payload?.cat?.name?.trim() ?? "";
  if (payload?.reason === "not_started") {
    return {
      title: catName || "Formulário indisponível",
      message: EXCLUSIVE_NOT_STARTED_MESSAGE,
    };
  }
  if (catName) {
    return {
      title: catName,
      message: exclusiveFoundHomeMessage(catName),
    };
  }
  return {
    title: "Formulário indisponível",
    message: EXCLUSIVE_GENERIC_CLOSED_MESSAGE,
  };
}

export async function getExclusiveCatForm(token: string): Promise<{
  ok: boolean;
  title: string;
  message: string;
  cat: AvailableAdoptionCat | null;
}> {
  const trimmed = token.trim();
  if (!trimmed) {
    return {
      ok: false,
      title: "Formulário indisponível",
      message: EXCLUSIVE_GENERIC_CLOSED_MESSAGE,
      cat: null,
    };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("get_exclusive_cat_form", {
      p_token: trimmed,
    });

    if (error) {
      console.error("Falha ao validar o formulário exclusivo:", error);
      return {
        ok: false,
        title: "Formulário indisponível",
        message: EXCLUSIVE_GENERIC_CLOSED_MESSAGE,
        cat: null,
      };
    }

    const payload = (data ?? null) as ExclusiveCatFormPayload | null;
    const cat = payload?.cat;
    if (!payload?.ok || !cat?.id || !cat.name?.trim()) {
      const closed = exclusiveClosedNotice(payload);
      return {
        ok: false,
        title: closed.title,
        message: closed.message,
        cat: null,
      };
    }

    return {
      ok: true,
      title: "",
      message: "",
      cat: {
        id: cat.id,
        name: cat.name.trim(),
        sex: cat.sex ?? "",
        furColor: (cat.fur_color ?? "").trim(),
        birthDateApprox: cat.birth_date_approx ?? null,
        photoUrl: (cat.photo_url ?? "").trim(),
        quarantineReleasedAt: cat.quarantine_released_at ?? null,
        fiv: (cat.fiv ?? "").trim(),
        felv: (cat.felv ?? "").trim(),
      },
    };
  } catch (error) {
    console.error("Falha ao validar o formulário exclusivo:", error);
    return {
      ok: false,
      title: "Formulário indisponível",
      message: EXCLUSIVE_GENERIC_CLOSED_MESSAGE,
      cat: null,
    };
  }
}

export async function getAdoptionFormAccess(token: string): Promise<boolean> {
  const trimmed = token.trim();
  if (!trimmed) return false;

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("get_adoption_form_access", {
      p_token: trimmed,
    });

    if (error) {
      console.error("Falha ao validar o token do formulário:", error);
      return false;
    }

    return Boolean((data as { ok?: boolean } | null)?.ok);
  } catch (error) {
    console.error("Falha ao validar o token do formulário:", error);
    return false;
  }
}

export async function loadAvailableAdoptionCats() {
  try {
    return await listAvailableAdoptionCats(getSupabaseServer());
  } catch (error) {
    console.error("Falha ao listar gatos disponíveis:", error);
    return [];
  }
}
