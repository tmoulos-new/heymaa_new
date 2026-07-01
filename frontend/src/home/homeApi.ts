export interface PublicOffer {
  id: string | number;
  title: string;
  body?: string;
  badge?: string;
  lang?: string;
  link?: string | null;
  expires_at?: string | null;
  image_key?: string | null;
  image_url?: string | null;
}

export interface PublicPromotion {
  id: string | number;
  title: string;
  body?: string;
  link?: string | null;
  expires_at?: string | null;
  image_key?: string | null;
  image_url?: string | null;
}

function getApiBase(): string {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  const h = window.location.hostname;
  if (h === "localhost" || h === "127.0.0.1") return "http://127.0.0.1:8000";
  return window.location.origin;
}

export async function fetchPublicOffers(lang: string): Promise<PublicOffer[]> {
  const res = await fetch(
    `${getApiBase()}/public/offers?lang=${encodeURIComponent(lang)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.offers) ? data.offers : [];
}

export async function fetchPublicPromotions(lang: string): Promise<PublicPromotion[]> {
  const res = await fetch(
    `${getApiBase()}/public/promotions?lang=${encodeURIComponent(lang)}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.promotions) ? data.promotions : [];
}
