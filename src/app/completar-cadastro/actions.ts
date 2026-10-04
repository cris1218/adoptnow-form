"use server";

import {
  DOCUMENT_NOT_RECOGNIZED_MESSAGE,
  verifiedDocumentCheck,
  verifyDocumentForForm,
  type DocumentCheckResult,
  type DocumentPhotoVerification,
} from "@/lib/documentCheck";
import { parseIdentityAddress } from "@/lib/identityAddress";
import { documentPhotoError } from "@/lib/questionnaire";
import { getSupabaseForCompletion } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { notifyStaffAdopterCompletion } from "@/lib/notifyStaff";

export type CompletionFormState = {
  ok: boolean;
  message: string;
} | null;

export type CompletionPrefill = {
  fullName: string;
  phone: string;
  document: string;
  cep: string;
  street: string;
  neighborhood: string;
  number: string;
  city: string;
  state: string;
};

type RpcResult = {
  ok?: boolean;
  error?: string;
  full_name?: string;
  phone?: string;
  document?: string;
  cep?: string;
  street?: string;
  neighborhood?: string;
  number?: string;
  city?: string;
  state?: string;
};

function normalizePhoneCipher(value: string): string {
  let cipher = value.trim().replace(/ /g, "+");
  if (cipher.includes("%")) {
    try {
      cipher = decodeURIComponent(cipher);
    } catch {
      // keep the current value
    }
  }
  return cipher.trim();
}

export async function loadAdopterCompletion(
  token: string,
  phoneCipher: string
): Promise<{ ok: true; data: CompletionPrefill } | { ok: false; message: string }> {
  const trimmedToken = token.trim();
  const trimmedCipher = normalizePhoneCipher(phoneCipher);
  if (!trimmedToken || !trimmedCipher) {
    return { ok: false, message: "Link inválido. Peça um novo link de cadastro." };
  }

  const looksLikeExample =
    /^(x+|y+|token|teste|test|example|exemplo)$/i.test(trimmedToken) ||
    /^(x+|y+|p+|cipher|teste|test|example|exemplo)$/i.test(trimmedCipher);
  if (looksLikeExample) {
    return {
      ok: false,
      message:
        "Este é só um exemplo de link. Envie o cadastro pelo app para gerar um token real, ou abra /completar-cadastro/preview para ver o layout.",
    };
  }

  try {
    const supabase = getSupabaseForCompletion();
    const { data, error } = await supabase.rpc("get_adopter_completion_form", {
      p_token: trimmedToken,
      p_phone_cipher: trimmedCipher,
    });

    if (error) {
      console.error("Erro ao carregar cadastro:", error);
      return {
        ok: false,
        message: "Não foi possível abrir este link agora. Tente novamente.",
      };
    }

    const result = data as RpcResult | null;
    if (!result?.ok) {
      return {
        ok: false,
        message: result?.error || "Este link é inválido, expirou ou já foi usado.",
      };
    }

    return {
      ok: true,
      data: {
        fullName: result.full_name ?? "",
        phone: result.phone ?? "",
        document: result.document ?? "",
        cep: result.cep ?? "",
        street: result.street ?? "",
        neighborhood: result.neighborhood ?? "",
        number: result.number ?? "",
        city: result.city ?? "",
        state: result.state ?? "",
      },
    };
  } catch (error) {
    console.error("Erro inesperado ao carregar cadastro:", error);
    return {
      ok: false,
      message: "Não foi possível abrir este link agora. Tente novamente.",
    };
  }
}

export async function verifyDocumentPhoto(
  token: string,
  phoneCipher: string,
  documentPhotoUrl: string
): Promise<DocumentPhotoVerification> {
  const denied: DocumentPhotoVerification = { status: "nao_verificado", proof: "" };
  const trimmedToken = token.trim();
  const trimmedCipher = normalizePhoneCipher(phoneCipher);
  if (!trimmedToken || !trimmedCipher) return denied;

  try {
    const { data, error } = await getSupabaseForCompletion().rpc(
      "get_adopter_completion_form",
      { p_token: trimmedToken, p_phone_cipher: trimmedCipher }
    );
    if (error || !(data as RpcResult | null)?.ok) return denied;
  } catch {
    return denied;
  }

  return verifyDocumentForForm(documentPhotoUrl.trim());
}

async function saveDocumentCheck(
  token: string,
  phoneCipher: string,
  check: DocumentCheckResult
): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) return;

  try {
    const { error } = await admin.rpc("set_adopter_document_check", {
      p_token: token,
      p_phone_cipher: phoneCipher,
      p_status: check.status,
      p_reason: check.reason,
    });
    if (error) {
      console.error("Falha ao salvar a verificação do documento:", error);
    }
  } catch (error) {
    console.error("Falha ao salvar a verificação do documento:", error);
  }
}

export async function submitAdopterCompletion(
  _prev: CompletionFormState,
  formData: FormData
): Promise<CompletionFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const phoneCipher = normalizePhoneCipher(
    String(formData.get("phoneCipher") ?? "")
  );
  const documentPhotoUrl = String(formData.get("documentPhotoUrl") ?? "").trim();

  if (!token || !phoneCipher) {
    return { ok: false, message: "Link inválido. Peça um novo link de cadastro." };
  }
  const { values: identity, error: identityError } =
    parseIdentityAddress(formData);
  const fieldError = identityError || documentPhotoError(documentPhotoUrl);
  if (fieldError) {
    return { ok: false, message: fieldError };
  }
  const check = verifiedDocumentCheck(
    documentPhotoUrl,
    String(formData.get("documentCheckProof") ?? "").trim()
  );
  if (!check) {
    return { ok: false, message: DOCUMENT_NOT_RECOGNIZED_MESSAGE };
  }
  if (String(formData.get("agreedToLgpd") ?? "") !== "true") {
    return {
      ok: false,
      message: "É preciso autorizar o uso dos dados conforme a LGPD.",
    };
  }

  try {
    const supabase = getSupabaseForCompletion();
    const { data, error } = await supabase.rpc("submit_adopter_completion", {
      p_token: token,
      p_phone_cipher: phoneCipher,
      p_document: identity.document,
      p_cep: identity.cep,
      p_street: identity.street,
      p_neighborhood: identity.neighborhood,
      p_number: identity.number,
      p_city: identity.city,
      p_state: identity.state,
      p_document_photo_url: documentPhotoUrl,
    });

    if (error) {
      console.error("Erro ao salvar cadastro:", error);
      return {
        ok: false,
        message: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    const result = data as RpcResult | null;
    if (!result?.ok) {
      return {
        ok: false,
        message: result?.error || "Não foi possível salvar os dados.",
      };
    }

    await saveDocumentCheck(token, phoneCipher, check);

    try {
      await notifyStaffAdopterCompletion(result.full_name ?? "", check.status);
    } catch (pushError) {
      console.error("Falha ao notificar a equipe:", pushError);
    }

    return {
      ok: true,
      message: "Cadastro atualizado. Obrigada! Você já pode fechar esta página.",
    };
  } catch (error) {
    console.error("Erro inesperado ao salvar cadastro:", error);
    return {
      ok: false,
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }
}
