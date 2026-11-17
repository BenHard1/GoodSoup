import { DIETS } from "@/features/households/food-options";
import { DIFFICULTIES, VISIBILITIES } from "./schemas";

/** 75 → « 1 h 15 », 45 → « 45 min », 120 → « 2 h ». */
export function formatMinutes(total: number | null | undefined): string {
  if (!total || total <= 0) return "";
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${String(m).padStart(2, "0")}` : `${h} h`;
}

export const difficultyLabel = (d: string | null) => DIFFICULTIES.find((x) => x.value === d)?.label ?? null;
export const visibilityLabel = (v: string) => VISIBILITIES.find((x) => x.value === v)?.label ?? v;
export const dietLabel = (v: string) => DIETS.find((d) => d.value === v)?.label ?? v;
