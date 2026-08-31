import { LANGS } from "../home/homeContent";

export type LanguagePickerItem = {
  code: string;
  name: string;
  displayCode: string;
  rtl: boolean;
  englishName: string;
  greekName: string;
  aliases: string[];
};

const DISPLAY_CODE: Record<string, string> = {
  el: "GR",
  en: "EN",
  it: "IT",
  de: "DE",
  fr: "FR",
  es: "ES",
  ro: "RO",
  bg: "BG",
  pl: "PL",
  sr: "RS",
  ar: "SA",
  tr: "TR",
  zh: "CN",
  ja: "JP",
  ru: "RU",
  pt: "PT",
  nl: "NL",
};

const LANG_NAMES: Record<string, { en: string; el: string; aliases: string[] }> = {
  el: { en: "Greek", el: "Ελληνικά", aliases: ["ellinika", "ellhnika", "greece", "hellenic", "gr"] },
  en: { en: "English", el: "Αγγλικά", aliases: ["agglika", "anglika", "eng", "uk", "us", "gb"] },
  it: { en: "Italian", el: "Ιταλικά", aliases: ["italika", "italiano"] },
  de: { en: "German", el: "Γερμανικά", aliases: ["germanika", "deutsch"] },
  fr: { en: "French", el: "Γαλλικά", aliases: ["gallika", "francais", "français"] },
  es: { en: "Spanish", el: "Ισπανικά", aliases: ["ispanika", "espanol", "español"] },
  ro: { en: "Romanian", el: "Ρουμανικά", aliases: ["roumanika", "romana", "română"] },
  bg: { en: "Bulgarian", el: "Βουλγαρικά", aliases: ["voulgarika", "balgarski"] },
  pl: { en: "Polish", el: "Πολωνικά", aliases: ["polonika", "polski"] },
  sr: { en: "Serbian", el: "Σερβικά", aliases: ["servika", "srpski"] },
  ar: { en: "Arabic", el: "Αραβικά", aliases: ["aravika", "arabia"] },
  tr: { en: "Turkish", el: "Τουρκικά", aliases: ["tourkika", "turkce", "türkçe"] },
  zh: { en: "Chinese", el: "Κινεζικά", aliases: ["kinezika", "zhongwen"] },
  ja: { en: "Japanese", el: "Ιαπωνικά", aliases: ["iaponika", "nihongo"] },
  ru: { en: "Russian", el: "Ρωσικά", aliases: ["rosika", "russkiy"] },
  pt: { en: "Portuguese", el: "Πορτογαλικά", aliases: ["portogalika", "portugues", "português"] },
  nl: { en: "Dutch", el: "Ολλανδικά", aliases: ["ollandika", "nederlands", "holland"] },
};

export function foldSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ς/g, "σ")
    .toLowerCase()
    .trim();
}

function greekToLatin(value: string, eta: "i" | "h"): string {
  let out = foldSearchText(value);
  const pairs: Array<[RegExp, string]> = [
    [/ου/g, "ou"],
    [/αι/g, "e"],
    [/ει/g, "i"],
    [/οι/g, "i"],
    [/αυ/g, "av"],
    [/ευ/g, "ev"],
    [/μπ/g, "b"],
    [/ντ/g, "d"],
    [/γκ/g, "g"],
    [/γγ/g, "ng"],
    [/τσ/g, "ts"],
    [/τζ/g, "tz"],
    [/θ/g, "th"],
    [/χ/g, "ch"],
    [/ψ/g, "ps"],
    [/ξ/g, "x"],
    [/α/g, "a"],
    [/β/g, "v"],
    [/γ/g, "g"],
    [/δ/g, "d"],
    [/ε/g, "e"],
    [/ζ/g, "z"],
    [/η/g, eta],
    [/ι/g, "i"],
    [/κ/g, "k"],
    [/λ/g, "l"],
    [/μ/g, "m"],
    [/ν/g, "n"],
    [/ο/g, "o"],
    [/π/g, "p"],
    [/ρ/g, "r"],
    [/σ/g, "s"],
    [/τ/g, "t"],
    [/υ/g, "i"],
    [/φ/g, "f"],
    [/ω/g, "o"],
  ];
  for (const [re, repl] of pairs) out = out.replace(re, repl);
  return out.replace(/[^a-z0-9]+/g, "");
}

function searchTokensFor(item: LanguagePickerItem): string[] {
  const raw = [
    item.code,
    item.displayCode,
    item.name,
    item.englishName,
    item.greekName,
    ...item.aliases,
  ];
  const tokens = new Set<string>();
  for (const value of raw) {
    const folded = foldSearchText(value);
    if (folded) tokens.add(folded.replace(/[^a-z0-9\u0370-\u03ff]+/g, ""));
    const latinI = greekToLatin(value, "i");
    const latinH = greekToLatin(value, "h");
    if (latinI) tokens.add(latinI);
    if (latinH) tokens.add(latinH);
  }
  return Array.from(tokens);
}

let cachedItems: LanguagePickerItem[] | null = null;
let cachedHaystack: Array<{ item: LanguagePickerItem; tokens: string[] }> | null = null;

export function getLanguagePickerItems(): LanguagePickerItem[] {
  if (cachedItems) return cachedItems;
  cachedItems = LANGS.map((lang) => {
    const names = LANG_NAMES[lang.code];
    return {
      code: lang.code,
      name: lang.name,
      displayCode: DISPLAY_CODE[lang.code] || lang.code.toUpperCase(),
      rtl: lang.rtl,
      englishName: names?.en || lang.name,
      greekName: names?.el || lang.name,
      aliases: names?.aliases || [],
    };
  });
  return cachedItems;
}

export function getLanguagePickerItem(code: string): LanguagePickerItem {
  const items = getLanguagePickerItems();
  return items.find((item) => item.code === code) || items[0];
}

export function filterLanguagePickerItems(query: string): LanguagePickerItem[] {
  const items = getLanguagePickerItems();
  const q = foldSearchText(query);
  if (!q) return items;

  const qCompact = q.replace(/[^a-z0-9\u0370-\u03ff]+/g, "");
  const qLatin = greekToLatin(q, "i");
  const needles = [qCompact, qLatin].filter(Boolean);

  if (!cachedHaystack) {
    cachedHaystack = items.map((item) => ({ item, tokens: searchTokensFor(item) }));
  }

  return cachedHaystack
    .filter(({ tokens }) =>
      needles.some((needle) =>
        tokens.some((token) =>
          needle.length <= 2 ? token === needle || token.startsWith(needle) : token.includes(needle),
        ),
      ),
    )
    .map(({ item }) => item);
}
