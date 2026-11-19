import { getSupabaseForCompletion, getSupabaseServer } from "@/lib/supabase";

export async function canPresignFormUpload(input: {
  accessToken?: string;
  phoneCipher?: string;
}): Promise<boolean> {
  const token = input.accessToken?.trim() ?? "";
  if (!token) return false;

  try {
    const supabase = getSupabaseServer();

    const { data: adoptionAccess } = await supabase.rpc(
      "get_adoption_form_access",
      { p_token: token }
    );
    if (Boolean((adoptionAccess as { ok?: boolean } | null)?.ok)) {
      return true;
    }

    const { data: exclusiveAccess } = await supabase.rpc(
      "get_exclusive_cat_form",
      { p_token: token }
    );
    if (Boolean((exclusiveAccess as { ok?: boolean } | null)?.ok)) {
      return true;
    }

    const phoneCipher = input.phoneCipher?.trim() ?? "";
    if (!phoneCipher) return false;

    const { data: completionAccess } = await getSupabaseForCompletion().rpc(
      "get_adopter_completion_form",
      {
        p_token: token,
        p_phone_cipher: phoneCipher,
      }
    );
    return Boolean((completionAccess as { ok?: boolean } | null)?.ok);
  } catch (error) {
    console.error("canPresignFormUpload", error);
    return false;
  }
}
