import type { SupabaseClient } from "@supabase/supabase-js";

export type AvailableAdoptionCat = {
  id: string;
  name: string;
  sex: "femea" | "macho" | string;
  furColor: string;
  birthDateApprox: string | null;
  photoUrl: string;
  quarantineReleasedAt: string | null;
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

export function formatBirthDateApprox(value: string | null | undefined): string {
  return formatIsoDateBr(value) || "Não informada";
}

type AvailableAdoptionCatRow = {
  id: string;
  name: string;
  sex: string;
  fur_color?: string | null;
  birth_date_approx?: string | null;
  photo_url?: string | null;
  quarantine_released_at?: string | null;
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
    }))
    .filter((row) => row.id && row.name);
}
