import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function hashAccessToken(accessToken: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(accessToken.trim())
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function consumeFormUploadQuota(input: {
  accessToken: string;
  kind: "document" | "video";
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      message: "Upload temporariamente indisponível.",
    };
  }

  const tokenHash = await hashAccessToken(input.accessToken);
  const { data, error } = await admin.rpc("consume_form_upload_presign_quota", {
    p_token_hash: tokenHash,
    p_kind: input.kind,
  });

  if (error) {
    console.error("consume_form_upload_presign_quota", error);
    return {
      ok: false,
      message: "Não foi possível validar o limite de envio.",
    };
  }

  const payload = data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return {
      ok: false,
      message:
        payload?.message?.trim() ||
        "Limite de envios deste link foi atingido.",
    };
  }

  return { ok: true };
}
