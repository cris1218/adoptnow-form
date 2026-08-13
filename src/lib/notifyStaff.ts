import { getFirstName } from "@/lib/masks";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type PushTokenRow = {
  expo_push_token: string;
};

export async function notifyStaffPotentialAdopter(
  fullName: string
): Promise<void> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn(
      "Push não enviado: defina SUPABASE_SERVICE_ROLE_KEY no servidor."
    );
    return;
  }

  const { data, error } = await supabase
    .from("push_tokens")
    .select("expo_push_token");

  if (error) {
    console.error("Falha ao ler push tokens:", error.message);
    return;
  }

  const tokens = [
    ...new Set(
      ((data ?? []) as PushTokenRow[])
        .map((row) => row.expo_push_token)
        .filter((token) => token.startsWith("ExponentPushToken"))
    ),
  ];

  if (tokens.length === 0) return;

  const firstName = getFirstName(fullName) || "Alguém";
  const title = "Possível adotante";
  const body = `${firstName} tem interesse em adotar um gatinho.`;

  for (let index = 0; index < tokens.length; index += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(index, index + EXPO_BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      sound: "default" as const,
      title,
      body,
      data: {
        type: "potential-adopter",
        fullName,
      },
    }));

    const response = await fetch(EXPO_PUSH_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Expo push falhou (${response.status}): ${text}`);
    }
  }
}
