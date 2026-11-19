"use server";

import {
  listAvailableAdoptionCats,
  type AvailableAdoptionCat,
} from "@/lib/availableCats";
import {
  mapHomeRaffle,
  mapHomeVaquinha,
  type HomeRaffleCard,
  type HomeVaquinhaCard,
} from "@/lib/home";
import { getSupabaseServer } from "@/lib/supabase";

export async function loadHomeCampaigns(): Promise<{
  cats: AvailableAdoptionCat[];
  raffles: HomeRaffleCard[];
  vaquinhas: HomeVaquinhaCard[];
}> {
  const supabase = getSupabaseServer();

  const [cats, rafflesResult, vaquinhasResult] = await Promise.all([
    listAvailableAdoptionCats(supabase),
    supabase.rpc("list_open_raffles_public"),
    supabase.rpc("list_open_vaquinhas_public"),
  ]);

  if (rafflesResult.error) {
    console.error("list_open_raffles_public", rafflesResult.error);
  }
  if (vaquinhasResult.error) {
    console.error("list_open_vaquinhas_public", vaquinhasResult.error);
  }

  const rafflesPayload = rafflesResult.data as {
    ok?: boolean;
    raffles?: Record<string, unknown>[];
  } | null;
  const vaquinhasPayload = vaquinhasResult.data as {
    ok?: boolean;
    vaquinhas?: Record<string, unknown>[];
  } | null;

  return {
    cats,
    raffles: Array.isArray(rafflesPayload?.raffles)
      ? rafflesPayload.raffles.map(mapHomeRaffle)
      : [],
    vaquinhas: Array.isArray(vaquinhasPayload?.vaquinhas)
      ? vaquinhasPayload.vaquinhas.map(mapHomeVaquinha)
      : [],
  };
}
