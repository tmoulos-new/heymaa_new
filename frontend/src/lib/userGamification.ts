import { GAMIFICATION_LEVELS } from "./gamificationCard";

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

export function applyPointsDelta(status: GamificationStatus, delta: number): GamificationStatus {
  const points = Math.max(0, (status.points || 0) + delta);
  const sorted = [...GAMIFICATION_LEVELS];
  let current = sorted[0];
  for (const row of sorted) {
    if (points >= row.min_points) current = row;
    else break;
  }
  const idx = sorted.findIndex((r) => r.number === current.number);
  const isMax = idx >= sorted.length - 1;
  const next = isMax ? null : sorted[idx + 1];
  const currentMin = current.min_points;
  const progressNeeded = next ? Math.max(next.min_points - currentMin, 1) : 0;
  const progressInLevel = Math.max(points - currentMin, 0);
  const pointsToNext = next ? Math.max(next.min_points - points, 0) : 0;
  const progressPercent = isMax
    ? 100
    : Math.min(100, Math.round((progressInLevel / progressNeeded) * 100));
  const toLevel = (row: (typeof sorted)[number], max: boolean): GamificationLevel => ({
    number: row.number,
    name_el: row.name_el,
    name_en: row.name_en,
    min_points: row.min_points,
    is_max: max,
  });
  return {
    points,
    level: toLevel(current, isMax),
    next_level: next ? toLevel(next, false) : null,
    progress_in_level: progressInLevel,
    progress_needed: progressNeeded,
    points_to_next: pointsToNext,
    progress_percent: progressPercent,
  };
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
