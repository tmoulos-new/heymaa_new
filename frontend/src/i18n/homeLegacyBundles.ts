import enHome from "../locales/en/home.json";
import enFaq from "../locales/en/faq.json";
import { C, LANGS, PLANS_BY_LANG, type Plan, type TranslationBundle } from "../home/homeContent";
import type { HomeFaqItem, HomeHowItem, HomePlan } from "./homeTypes";

const PLAN_VARIANTS = ["trial", "starter", "premium", "annual"] as const;

const HOW_STYLES: Array<{ icon: string; bg: string; color: string }> = [
  { icon: "ti-pencil", bg: "rgba(248,229,214,0.45)", color: "#D4764E" },
  { icon: "ti-microphone", bg: "rgba(124,92,191,0.14)", color: "#7C5CBF" },
  { icon: "ti-camera", bg: "rgba(74,190,170,0.16)", color: "#2D9E6B" },
];

const SIGN_IN_BY_LANG: Record<string, string> = {
  el: "Σύνδεση",
  en: "Sign in",
  ar: "تسجيل الدخول",
  zh: "登录",
  es: "Iniciar sesión",
  fr: "Connexion",
  ro: "Autentificare",
  pl: "Zaloguj się",
  tr: "Giriş yap",
  hi: "साइन इन",
  ur: "سائن ان",
  ja: "サインイン",
  ru: "Войти",
  de: "Anmelden",
  pt: "Entrar",
  it: "Accedi",
  nl: "Inloggen",
  bn: "সাইন ইন",
  id: "Masuk",
  sw: "Ingia",
  fil: "Mag-sign in",
  mr: "साइन इन",
  te: "సైన్ ఇన్",
  bg: "Вход",
  sr: "Пријава",
};

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function legacyCopy(lang: string): TranslationBundle {
  return C[lang] || C.en;
}

function demoShort(label: string): string {
  const trimmed = (label || "").trim();
  if (!trimmed) return "Free";
  const words = trimmed.split(/\s+/);
  return words.length > 1 ? words[0] : trimmed.slice(0, 12);
}

function convertHowItems(how: TranslationBundle["how"]): HomeHowItem[] {
  return (how || []).slice(0, 3).map((item, index) => {
    const style = HOW_STYLES[index] || HOW_STYLES[0];
    return {
      icon: style.icon,
      bg: style.bg,
      color: style.color,
      title: item.t,
      lead: "",
      body: item.b,
    };
  });
}

function convertPlans(plans: Plan[]): HomePlan[] {
  return plans.slice(0, 4).map((plan, index) => ({
    icon: plan.ico,
    name: plan.n,
    price: plan.p,
    period: plan.per,
    badge: plan.badge || "",
    badgeColor: plan.bc || "",
    variant: PLAN_VARIANTS[index] || "trial",
    featured: plan.cls === "popular",
    save: plan.save || "",
    features: plan.feats.map((label) => ({ label })),
    button: plan.btn,
    buttonClass: "btn-plan-idle",
  }));
}

function splitCtaParagraph(text: string): { line1: string; line3: string } {
  const parts = (text || "").split("\n").map((part) => part.trim()).filter(Boolean);
  return {
    line1: parts[0] || "",
    line3: parts.slice(1).join(" ") || "",
  };
}

function convertLandingFaqs(faqs: TranslationBundle["faqs"]): HomeFaqItem[] {
  return (faqs || []).map((item) => ({
    question: item.q,
    answer: item.a,
  }));
}

/** Build a landing home bundle for langs that predate el/en JSON (from homeContent.js). */
export function buildLegacyHomeBundle(lang: string): Record<string, unknown> {
  const legacy = legacyCopy(lang);
  const base = clone(enHome) as Record<string, unknown>;
  const pricing = base.pricing as typeof enHome.pricing;
  const ctaParts = splitCtaParagraph(legacy.cta_p);
  const nbCta =
    legacy.nb_cta ||
    legacy.cta1 ||
    legacy.cta_main ||
    (base.nav as typeof enHome.nav).demo;
  const plans = PLANS_BY_LANG[lang] || PLANS_BY_LANG.en;
  const nav = base.nav as typeof enHome.nav;
  const langPicker = base.langPicker as typeof enHome.langPicker;
  const hero = base.hero as typeof enHome.hero;
  const how = base.how as typeof enHome.how;
  const faq = base.faq as typeof enHome.faq;
  const cta = base.cta as typeof enHome.cta;
  const footer = base.footer as typeof enHome.footer;

  base.nav = {
    ...nav,
    signIn: SIGN_IN_BY_LANG[lang] || SIGN_IN_BY_LANG.en,
    demo: nbCta.replace(/\s*→\s*$/, ""),
    demoShort: demoShort(nbCta),
  };

  base.langPicker = {
    ...langPicker,
    title: (legacy.lp || langPicker.title).replace(/^🌐\s*/, ""),
  };

  base.hero = {
    ...hero,
    badge: legacy.hb || hero.badge,
    title: legacy.h1 || hero.title,
    subtitle: legacy.hsub || hero.subtitle,
    cta: legacy.cta_main || nbCta.replace(/\s*→\s*$/, ""),
    pillLanguages: legacy.hp?.[2] || hero.pillLanguages,
  };

  base.how = {
    label: legacy.how_lbl || "",
    title: legacy.how_ttl || how.title,
    subtitle: legacy.how_sub || how.subtitle,
    items: convertHowItems(legacy.how),
  };

  base.pricing = {
    ...pricing,
    label: legacy.pr_lbl || pricing.label,
    title: legacy.pr_ttl || pricing.title,
    plans: convertPlans(plans),
  };

  base.faq = {
    label: legacy.faq_lbl || enFaq.label || faq.label,
    title: legacy.faq_ttl || "",
    landingItems: convertLandingFaqs(legacy.faqs),
    items: enFaq.items,
  };

  base.cta = {
    ...cta,
    line1: ctaParts.line1 || cta.line1,
    headline: legacy.cta_h || cta.headline,
    line3: ctaParts.line3 || cta.line3,
    secondaryButton: legacy.cta2 || cta.secondaryButton,
    button: legacy.cta_main || cta.button,
  };

  if (legacy.footer) {
    base.footer = {
      ...footer,
      copy: legacy.footer,
    };
  }

  return base;
}

const _legacyLangs = new Set<string>([
  ...LANGS.map((lang) => lang.code),
  ...Object.keys(C),
  ...Object.keys(PLANS_BY_LANG),
]);

/** Language codes with a legacy landing bundle (everything except el/en JSON). */
export const LEGACY_HOME_LANGS: readonly string[] = Array.from(_legacyLangs)
  .filter((code) => code !== "el" && code !== "en")
  .sort();

export function hasLegacyHomeBundle(lang: string): boolean {
  return LEGACY_HOME_LANGS.includes(lang);
}
