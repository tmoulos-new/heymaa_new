export type GamificationLevel = {
  number: number;
  name_el: string;
  name_en: string;
  min_points: number;
  is_max: boolean;
};

export type GamificationStatus = {
  points: number;
  level: GamificationLevel;
  next_level: GamificationLevel | null;
  progress_in_level: number;
  progress_needed: number;
  points_to_next: number;
  progress_percent: number;
};

export function levelName(level: Pick<GamificationLevel, "name_el" | "name_en">, lang: string): string {
  return lang === "el" ? level.name_el : level.name_en;
}
