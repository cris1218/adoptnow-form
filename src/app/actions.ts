"use server";

import { getSupabaseServer } from "@/lib/supabase";
import { isValidPhone, normalizePhone } from "@/lib/masks";
import { notifyStaffPotentialAdopter } from "@/lib/notifyStaff";
import { parseAnswers, toInsertRow } from "@/lib/questionnaire";

export type FormState = {
  ok: boolean;
  message: string;
} | null;

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

  const phone = normalizePhone(String(formData.get("phone") ?? ""));

  if (!isValidPhone(phone)) {
    return { ok: false, message: "Informe um telefone válido com DDD." };
  }

  const parsed = parseAnswers(formData, phone);
  if (parsed.error || !parsed.answers) {
    return { ok: false, message: parsed.error ?? "Revise as respostas." };
  }

  try {
    const supabase = getSupabaseServer();
    const { error } = await supabase
      .from("potential_adopters")
      .insert(toInsertRow(parsed.answers));

    if (error) {
      console.error("Erro ao salvar possível adotante:", error);
      return {
        ok: false,
        message: "Não foi possível enviar agora. Tente novamente em instantes.",
      };
    }

    try {
      await notifyStaffPotentialAdopter(parsed.answers.fullName);
    } catch (pushError) {
      console.error("Falha ao notificar a equipe:", pushError);
    }

    return {
      ok: true,
      message:
        "Obrigada pelo interesse. A equipe do Recanto do Ron Ron entra em contato pelo WhatsApp.",
    };
  } catch (error) {
    console.error("Erro inesperado ao salvar possível adotante:", error);
    return {
      ok: false,
      message: "Não foi possível enviar agora. Tente novamente em instantes.",
    };
  }
}
