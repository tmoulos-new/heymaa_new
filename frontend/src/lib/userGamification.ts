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

export function defaultGamificationStatus(): GamificationStatus {
  return {
    points: 0,
    level: {
      number: 1,
      name_el: "Νέα Μαμά",
      name_en: "New Mom",
      min_points: 0,
      is_max: false,
    },
    next_level: {
      number: 2,
      name_el: "Ενεργή Μαμά",
      name_en: "Active Mom",
      min_points: 250,
      is_max: false,
    },
    progress_in_level: 0,
    progress_needed: 250,
    points_to_next: 250,
    progress_percent: 0,
  };
}
