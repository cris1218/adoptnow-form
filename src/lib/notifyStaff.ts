import type { DocumentCheckStatus } from "@/lib/documentCheck";
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

function isExpoPushToken(token: string): boolean {
  return (
    token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")
  );
}

async function notifyStaff(message: StaffPushMessage): Promise<number> {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn(
      "Push não enviado: defina SUPABASE_SERVICE_ROLE_KEY no servidor."
    );
    return 0;
  }

  const { data, error } = await supabase
    .from("push_tokens")
    .select("expo_push_token");

  if (error) {
    console.error("Falha ao ler push tokens:", error.message);
    return 0;
  }

  const tokens = [
    ...new Set(
      ((data ?? []) as PushTokenRow[])
        .map((row) => row.expo_push_token)
        .filter((token): token is string => Boolean(token) && isExpoPushToken(token))
    ),
  ];

  if (tokens.length === 0) {
    console.warn("Push não enviado: nenhum expo_push_token cadastrado.");
    return 0;
  }

  let sent = 0;
  for (let index = 0; index < tokens.length; index += EXPO_BATCH_SIZE) {
    const batch = tokens.slice(index, index + EXPO_BATCH_SIZE);
    const messages = batch.map((token) => ({
      to: token,
      sound: "default" as const,
      priority: "high" as const,
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
      continue;
    }

    sent += batch.length;
    const payload = (await response.json().catch(() => null)) as unknown;
    console.log("Expo push enviado", {
      devices: batch.length,
      payload,
    });
  }

  return sent;
}

function documentCheckNote(documentCheck: DocumentCheckStatus): string {
  if (documentCheck === "verificado") return "";
  if (documentCheck === "reprovado") {
    return " A foto enviada não parece um documento. Confira.";
  }
  return " Não foi possível conferir o documento automaticamente.";
}

export async function notifyStaffExclusiveCatInterest(
  fullName: string,
  catName: string,
  documentCheck: DocumentCheckStatus
): Promise<void> {
  const person = fullName.trim() || "Alguém";
  const cat = catName.trim() || "gato exclusivo";

  await notifyStaff({
    title: "Gato exclusivo",
    body: `${person} tem interesse em adotar o/a ${cat}!${documentCheckNote(documentCheck)}`,
    data: {
      type: "exclusive-cat-interest",
      fullName: person,
      interestedCatName: cat,
      documentCheck,
    },
  });
}

export async function notifyStaffPotentialAdopter(
  fullName: string,
  interestedCatName: string,
  documentCheck: DocumentCheckStatus
): Promise<void> {
  const firstName = getFirstName(fullName) || "Alguém";
  const catName = interestedCatName.trim();
  const interest = catName
    ? `${firstName} tem interesse em ${catName}.`
    : `${firstName} tem interesse em adotar um gatinho.`;

  await notifyStaff({
    title: "Possível adotante",
    body: `${interest}${documentCheckNote(documentCheck)}`,
    data: {
      type: "potential-adopter",
      fullName,
      interestedCatName: catName,
      documentCheck,
    },
  });
}

export async function notifyStaffAdopterCompletion(
  fullName: string,
  documentCheck: DocumentCheckStatus
): Promise<void> {
  const name = fullName.trim() || "Alguém";

  await notifyStaff({
    title: "Cadastro de adoção",
    body: `${name} preencheu os dados para adoção.${documentCheckNote(documentCheck)}`,
    data: {
      type: "adopter-completion",
      fullName: name,
      documentCheck,
    },
  });
}

export async function notifyStaffKnownPersonAutoApproved(
  fullName: string,
  interestedCatName: string
): Promise<void> {
  const firstName = getFirstName(fullName) || "Alguém";
  const catName = interestedCatName.trim();
  const interest = catName
    ? `${firstName} tem interesse em ${catName}.`
    : `${firstName} tem interesse em adotar um gatinho.`;

  await notifyStaff({
    title: "Interessado aprovado",
    body: `${interest} CPF já conhecido, mesmo endereço — aprovado automaticamente.`,
    data: {
      type: "potential-adopter-auto-approved",
      fullName,
      interestedCatName: catName,
    },
  });
}

export async function notifyStaffRafflePaymentProof(input: {
  orderId: string;
  phone: string;
  raffleId?: string;
  raffleTitle?: string;
}): Promise<number> {
  const title = (input.raffleTitle ?? "").trim() || "Rifa";
  return notifyStaff({
    title: "Comprovante de rifa",
    body: `${title}: comprovante Pix enviado. Confirme ou rejeite no app.`,
    data: {
      type: "raffle-payment-proof",
      orderId: input.orderId,
      phone: input.phone,
      raffleId: input.raffleId ?? "",
      raffleTitle: title,
    },
  });
}
