/**
 * Babyspace-vendorized milestone catalogs for the Milestones checklist UI.
 * Data: frontend/src/data/milestones/catalog.el.json (+ catalog.i18n.json).
 * Refresh: re-run backend/milestones_vendorize.py about every 6 months.
 */
import catalogEl from "../data/milestones/catalog.el.json";
import catalogI18n from "../data/milestones/catalog.i18n.json";

export type MilestoneKind =
  | "pregnancy_week"
  | "baby_month"
  | "toddler_range"
  | "child_year";

export type MilestoneStage = {
  id: string;
  kind: MilestoneKind;
  label_el: string;
  week?: number;
  month?: number;
  year?: number;
  age_months_min?: number;
  age_months_max?: number;
  source_url?: string;
  source_title?: string;
  bullets?: { el?: string[] };
};

type CatalogEl = {
  version: number;
  stages: MilestoneStage[];
};

type CatalogI18n = {
  version: number;
  by_lang: Record<string, Record<string, string[]>>;
};

const elCatalog = catalogEl as CatalogEl;
const i18nCatalog = catalogI18n as CatalogI18n;

const stagesById = new Map(
  (elCatalog.stages || []).map((s) => [s.id, s] as const),
);

export function listMilestoneStages(): MilestoneStage[] {
  return elCatalog.stages || [];
}

export function getStageById(id: string): MilestoneStage | undefined {
  return stagesById.get(id);
}

/** Map child age in months → babyspace stage id (skips year 3 → year 4). */
export function stageIdForAgeMonths(ageMonths: number): string {
  const m = Number.isFinite(ageMonths) ? ageMonths : 0;
  if (m < 0) return "baby_m1";
  if (m < 12) {
    const month = Math.max(1, Math.min(12, Math.floor(m) + 1));
    return `baby_m${month}`;
  }
  if (m < 15) return "toddler_12_15";
  if (m < 18) return "toddler_15_18";
  if (m < 24) return "toddler_18_24";
  if (m < 36) return "toddler_24_36";
  // ≥36 months → year 4+ (no separate year-3 band)
  const years = Math.floor(m / 12);
  const year = Math.max(4, Math.min(12, years === 3 ? 4 : years));
  return `child_y${year}`;
}

export function stageIdForPregnancyWeek(week: number): string {
  const w = Math.max(1, Math.min(40, Math.round(week) || 1));
  return `preg_w${w}`;
}

/**
 * Localized bullets for a stage.
 * Returns [] when the requested language pack is missing so App.tsx can
 * fall back to the previous hardcoded catalogs (avoids showing Greek to EN users).
 */
export function getMilestoneBullets(stageId: string, lang: string): string[] {
  const code = (lang || "en").toLowerCase();
  const byLang = i18nCatalog.by_lang || {};
  const pack = byLang[code]?.[stageId];
  if (pack?.length) return pack;
  if (code !== "el") {
    const en = byLang.en?.[stageId];
    if (en?.length) return en;
    return [];
  }
  const el = byLang.el?.[stageId];
  if (el?.length) return el;
  return stagesById.get(stageId)?.bullets?.el || [];
}

export function getMilestonesForAgeMonths(
  ageMonths: number,
  lang: string,
): string[] {
  return getMilestoneBullets(stageIdForAgeMonths(ageMonths), lang);
}

export function getPregnancyMilestonesForWeek(
  week: number,
  lang: string,
): string[] {
  return getMilestoneBullets(stageIdForPregnancyWeek(week), lang);
}
