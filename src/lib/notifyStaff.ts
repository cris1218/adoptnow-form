import { getFirstName } from "@/lib/masks";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

type PushTokenRow = {
  expo_push_token: string;
};

type StaffPushMessage = {
  title: string;
  body: string;
  data: Record<string, string>;
};

async function notifyStaff(message: StaffPushMessage): Promise<void> {
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

  for (let index = 0; index < tokens.length; index += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(index, index + EXPO_BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      sound: "default" as const,
      channelId: "potential-adopters",
      title: message.title,
      body: message.body,
      data: message.data,
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

export async function notifyStaffPotentialAdopter(
  fullName: string,
  interestedCatName = ""
): Promise<void> {
  const firstName = getFirstName(fullName) || "Alguém";
  const catName = interestedCatName.trim();

  await notifyStaff({
    title: "Possível adotante",
    body: catName
      ? `${firstName} tem interesse em ${catName}.`
      : `${firstName} tem interesse em adotar um gatinho.`,
    data: {
      type: "potential-adopter",
      fullName,
      interestedCatName: catName,
    },
  });
}

export async function notifyStaffAdopterCompletion(
  fullName: string
): Promise<void> {
  const name = fullName.trim() || "Alguém";

  await notifyStaff({
    title: "Cadastro de adoção",
    body: `${name} preencheu os dados para adoção.`,
    data: {
      type: "adopter-completion",
      fullName: name,
    },
  });
}
