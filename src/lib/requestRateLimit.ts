import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

async function hashValue(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function clientIpFromHeaders(
  headerList: Headers | { get(name: string): string | null }
): string {
  const forwarded = headerList.get("x-forwarded-for")?.split(",")[0]?.trim();
  if (forwarded) return forwarded;
  const realIp = headerList.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

export async function consumeRequestRateLimit(input: {
  bucket: string;
  limit: number;
  windowSeconds: number;
  ip: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return {
      ok: false,
      message: "Serviço temporariamente indisponível. Tente de novo em instantes.",
    };
  }

  const ip = input.ip.trim() || "unknown";
  const ipHash = await hashValue(ip);
  const { data, error } = await admin.rpc("consume_request_rate_limit", {
    p_ip_hash: ipHash,
    p_bucket: input.bucket,
    p_limit: input.limit,
    p_window_seconds: input.windowSeconds,
  });

  if (error) {
    console.error("consume_request_rate_limit", error);
    return {
      ok: false,
      message: "Muitas tentativas. Aguarde um pouco e tente de novo.",
    };
  }

  const payload = data as { ok?: boolean; message?: string } | null;
  if (!payload?.ok) {
    return {
      ok: false,
      message:
        payload?.message?.trim() ||
        "Muitas tentativas. Aguarde um pouco e tente de novo.",
    };
  }

  return { ok: true };
}
