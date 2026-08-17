import type { SupabaseClient } from "@supabase/supabase-js";

export type AvailableAdoptionCat = {
  id: string;
  name: string;
  sex: "femea" | "macho" | string;
  furColor: string;
  birthDateApprox: string | null;
  photoUrl: string;
  quarantineReleasedAt: string | null;
  fiv: string;
  felv: string;
};

export function formatCatSex(sex: string): string {
  if (sex === "femea") return "fêmea";
  if (sex === "macho") return "macho";
  return sex;
}

export function formatCatSexLabel(sex: string): string {
  if (sex === "femea") return "Fêmea";
  if (sex === "macho") return "Macho";
  return sex.trim() || "Não informado";
}

export function formatIsoDateBr(value: string | null | undefined): string {
  const raw = (value ?? "").trim().slice(0, 10);
  const [year, month, day] = raw.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
}

export function formatApproximateAge(value: string | null | undefined): string {
  const raw = (value ?? "").trim().slice(0, 10);
  const [yearStr, monthStr, dayStr] = raw.split("-");
  const birthYear = Number(yearStr);
  const birthMonth = Number(monthStr);
  const birthDay = Number(dayStr);
  if (!birthYear || !birthMonth || !birthDay) return "Não informada";

  const now = new Date();
  let years = now.getFullYear() - birthYear;
  let months = now.getMonth() + 1 - birthMonth;

  if (now.getDate() < birthDay) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  if (years < 0) return "Não informada";
  if (years === 0 && months === 0) return "menos de 1 mês";

  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} ${years === 1 ? "ano" : "anos"}`);
  }
  if (months > 0) {
    parts.push(`${months} ${months === 1 ? "mês" : "meses"}`);
  }

  return parts.join(" e ");
}

export function formatFivFelvResult(
  value: string | null | undefined,
): string | null {
  const result = (value ?? "").trim().toLowerCase();
  if (result === "positivo") return "Positivo";
  if (result === "negativo") return "Negativo";
  return null;
}

type AvailableAdoptionCatRow = {
  id: string;
  name: string;
  sex: string;
  fur_color?: string | null;
  birth_date_approx?: string | null;
  photo_url?: string | null;
  quarantine_released_at?: string | null;
  fiv?: string | null;
  felv?: string | null;
};

export async function listAvailableAdoptionCats(
  supabase: SupabaseClient
): Promise<AvailableAdoptionCat[]> {
  const { data, error } = await supabase.rpc("list_available_adoption_cats");

  if (error) {
    console.error("Falha ao listar gatos disponíveis:", error.message);
    return [];
  }

  return ((data ?? []) as AvailableAdoptionCatRow[])
    .map((row) => ({
      id: row.id,
      name: (row.name ?? "").trim(),
      sex: row.sex ?? "",
      furColor: (row.fur_color ?? "").trim(),
      birthDateApprox: row.birth_date_approx ?? null,
      photoUrl: (row.photo_url ?? "").trim(),
      quarantineReleasedAt: row.quarantine_released_at ?? null,
      fiv: (row.fiv ?? "").trim(),
      felv: (row.felv ?? "").trim(),
    }))
    .filter((row) => row.id && row.name);
}
