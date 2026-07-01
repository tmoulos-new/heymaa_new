export const FLAGS: Record<string, string>;
export const LANGS: Array<{ code: string; name: string; voice: string; rtl: boolean }>;
export const PLANS_BY_LANG: Record<string, Plan[]>;
export const SAFETY_BY_LANG: Record<string, SafetyItem[]>;
export const C: Record<string, TranslationBundle>;

export function mf(code: string, w: number, h: number): string;

export interface Plan {
  ico: string;
  n: string;
  p: string;
  per: string;
  badge: string;
  bc: string;
  cls: string;
  save: string;
  feats: string[];
  btn: string;
  bcls: string;
}

export interface SafetyItem {
  ico: string;
  bg: string;
  t: string;
  b: string;
}

export interface TranslationBundle {
  lp: string;
  hb: string;
  h1: string;
  hsub: string;
  cta2: string;
  hp: string[];
  how_lbl: string;
  how_ttl: string;
  how_sub: string;
  how: Array<{ ico: string; t: string; b: string }>;
  feat_lbl: string;
  feat_ttl: string;
  feat_sub: string;
  feats: Array<{ ico: string; bg: string; t: string; b: string }>;
  pr_lbl: string;
  pr_ttl: string;
  sf_lbl: string;
  sf_ttl: string;
  sf_sub: string;
  faq_lbl: string;
  faq_ttl: string;
  faqs: Array<{ q: string; a: string }>;
  cta_h: string;
  cta_p: string;
  footer: string;
}
