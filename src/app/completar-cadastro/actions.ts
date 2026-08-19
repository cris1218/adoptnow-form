"use server";

import { getSupabaseServer } from "@/lib/supabase";
import { notifyStaffAdopterCompletion } from "@/lib/notifyStaff";
import { isValidCep, isValidCpf, onlyDigits } from "@/lib/masks";
import { isFormDocumentUrl } from "@/lib/questionnaire";

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

export async function loadAdopterCompletion(
  token: string,
  phoneCipher: string
): Promise<{ ok: true; data: CompletionPrefill } | { ok: false; message: string }> {
  const trimmedToken = token.trim();
  const trimmedCipher = phoneCipher.trim();
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
    const supabase = getSupabaseServer();
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

export async function submitAdopterCompletion(
  _prev: CompletionFormState,
  formData: FormData
): Promise<CompletionFormState> {
  const token = String(formData.get("token") ?? "").trim();
  const phoneCipher = String(formData.get("phoneCipher") ?? "").trim();
  const document = onlyDigits(String(formData.get("document") ?? ""));
  const cep = onlyDigits(String(formData.get("cep") ?? ""));
  const street = String(formData.get("street") ?? "").trim();
  const neighborhood = String(formData.get("neighborhood") ?? "").trim();
  const number = String(formData.get("number") ?? "").trim();
  const city = String(formData.get("city") ?? "").trim();
  const state = String(formData.get("state") ?? "").trim().toUpperCase();
  const documentPhotoUrl = String(formData.get("documentPhotoUrl") ?? "").trim();

  if (!token || !phoneCipher) {
    return { ok: false, message: "Link inválido. Peça um novo link de cadastro." };
  }
  if (!isValidCpf(document)) {
    return { ok: false, message: "Informe um CPF válido com 11 dígitos." };
  }
  if (!isValidCep(cep)) {
    return { ok: false, message: "Informe um CEP válido." };
  }
  if (
    street.length < 2 ||
    neighborhood.length < 2 ||
    number.length < 1 ||
    city.length < 2 ||
    state.length !== 2
  ) {
    return { ok: false, message: "Preencha o endereço completo." };
  }
  if (documentPhotoUrl && !isFormDocumentUrl(documentPhotoUrl)) {
    return { ok: false, message: "A foto do documento é inválida. Envie novamente." };
  }

  try {
    const supabase = getSupabaseServer();
    const { data, error } = await supabase.rpc("submit_adopter_completion", {
      p_token: token,
      p_phone_cipher: phoneCipher,
      p_document: document,
      p_cep: cep,
      p_street: street,
      p_neighborhood: neighborhood,
      p_number: number,
      p_city: city,
      p_state: state,
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

    try {
      await notifyStaffAdopterCompletion(result.full_name ?? "");
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
