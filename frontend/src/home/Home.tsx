import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTE } from "../publicRoutes";
import {
  C,
  LANGS,
  PLANS_BY_LANG,
  SAFETY_BY_LANG,
  mf,
  type Plan,
} from "./homeContent";
import {
  fetchPublicOffers,
  fetchPublicPromotions,
  type PublicOffer,
  type PublicPromotion,
} from "./homeApi";
import "./home.css";

const TABLER_ICONS =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

const SIGN_IN_LABEL: Record<string, string> = {
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
  tl: "Mag-sign in",
  mr: "साइन इन",
  te: "సైన్ ఇన్",
};

const FEED_LABELS: Record<
  string,
  { offers: string; promotions: string; learn: string; getIt: string; emptyOffers: string; emptyPromotions: string; sponsored: string }
> = {
  el: {
    offers: "Προσφορές",
    promotions: "Προωθητικές ενέργειες",
    learn: "Μάθε περισσότερα →",
    getIt: "Πάρε το",
    emptyOffers: "Δεν υπάρχουν ενεργές προσφορές.",
    emptyPromotions: "Δεν υπάρχουν ενεργές προωθήσεις.",
    sponsored: "Χορηγούμενο",
  },
  en: {
    offers: "Offers",
    promotions: "Promotions",
    learn: "Learn more →",
    getIt: "Get it",
    emptyOffers: "No active offers right now.",
    emptyPromotions: "No active promotions right now.",
    sponsored: "Sponsored",
  },
};

function feedLabels(lang: string) {
  return FEED_LABELS[lang] || FEED_LABELS.en;
}

function offerBadgeClass(badge?: string): string {
  if (badge === "promo") return "feed-badge-promo";
  if (badge === "sponsored") return "feed-badge-sponsored";
  return "feed-badge-offer";
}

function FlagHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`plan ${plan.cls}`}
      style={{ marginTop: plan.badge ? "14px" : "0" }}
    >
      {plan.badge ? (
        <div className="plan-badge" style={{ background: plan.bc }}>
          {plan.badge}
        </div>
      ) : null}
      <div className="plan-ico">{plan.ico}</div>
      <div className="plan-name">{plan.n}</div>
      <div className="plan-price">{plan.p}</div>
      <div className="plan-period">{plan.per}</div>
      <div className="plan-save">{plan.save || "\u00a0"}</div>
      <ul className="plan-feats">
        {plan.feats.map((f) => (
          <li key={f}>
            <i className="ti ti-check" />
            {f}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`plan-btn ${plan.bcls}`}
        disabled={plan.cls === "current"}
      >
        {plan.btn}
      </button>
    </div>
  );
}

function FeedCard({
  item,
  badge,
  badgeClass,
  learnLabel,
  getItLabel,
  onGetIt,
}: {
  item: { id: string | number; title: string; body?: string; link?: string | null; image_url?: string | null };
  badge?: string;
  badgeClass: string;
  learnLabel: string;
  getItLabel: string;
  onGetIt: () => void;
}) {
  return (
    <article className="feed-card">
      {badge ? (
        <span className={`feed-badge ${badgeClass}`}>{badge}</span>
      ) : null}
      {item.image_url ? (
        <img src={item.image_url} alt="" className="feed-img" />
      ) : null}
      <div className="feed-title">{item.title}</div>
      {item.body ? <div className="feed-body">{item.body}</div> : null}
      {item.link ? (
        <a
          href={item.link}
          target="_blank"
          rel="noopener noreferrer"
          className="feed-link"
        >
          {learnLabel}
        </a>
      ) : null}
      <div className="feed-card-overlay">
        <button type="button" className="feed-get-btn" onClick={onGetIt}>
          {getItLabel}
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const [lang, setLang] = useState(
    () => localStorage.getItem("hm_pre_lang") || "el"
  );
  const [langOpen, setLangOpen] = useState(false);
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({});
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const goToApp = useCallback(() => navigate(APP_ROUTE), [navigate]);
  const labels = feedLabels(lang);

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    Promise.all([fetchPublicOffers(lang), fetchPublicPromotions(lang)])
      .then(([o, p]) => {
        if (cancelled) return;
        setOffers(o);
        setPromotions(p);
      })
      .catch(() => {
        if (!cancelled) {
          setOffers([]);
          setPromotions([]);
        }
      })
      .finally(() => {
        if (!cancelled) setFeedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TABLER_ICONS;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  const langMeta = useMemo(
    () => LANGS.find((l) => l.code === lang) || LANGS[0],
    [lang]
  );
  const t = C[lang] || C.en;
  const plans = PLANS_BY_LANG[lang] || PLANS_BY_LANG.en;
  const safety = SAFETY_BY_LANG[lang] || SAFETY_BY_LANG.en;
  const stripItems = useMemo(() => [...LANGS, ...LANGS], []);

  const selectLang = (code: string) => {
    setLang(code);
    localStorage.setItem("hm_pre_lang", code);
    setLangOpen(false);
    setOpenFaqs({});
  };

  const toggleFaq = (index: number) => {
    setOpenFaqs((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div id="landing-page">
      <div id="page" dir={langMeta.rtl ? "rtl" : "ltr"}>
        <div
          className={`lang-overlay${langOpen ? " open" : ""}`}
          onClick={(e) => {
            if (e.target === e.currentTarget) setLangOpen(false);
          }}
          role="presentation"
        >
          <div className="lang-box">
            <div className="lang-box-hdr">
              <div className="lang-box-title">{t.lp}</div>
              <button
                type="button"
                className="lang-close"
                onClick={() => setLangOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
            </div>
            <div className="flag-grid">
              {LANGS.map((l) => (
                <button
                  type="button"
                  key={l.code}
                  className={`flag-item${l.code === lang ? " active" : ""}`}
                  onClick={() => selectLang(l.code)}
                >
                  <FlagHtml html={mf(l.code, 40, 27)} />
                  <span className="flag-lname">{l.name}</span>
                  <span className="flag-lvoice">{l.voice}</span>
                  <span className="active-pip" />
                </button>
              ))}
            </div>
          </div>
        </div>

        <nav className="navbar">
          <div className="nb-logo">
            <img src={`${process.env.PUBLIC_URL}/logo192.png`} alt="HeyMaa logo" />
            <span className="nb-logo-text">
              Hey<span>Maa</span>
            </span>
          </div>
          <div className="nb-right">
            <button
              type="button"
              className="lang-trigger"
              onClick={() => setLangOpen(true)}
            >
              <FlagHtml html={mf(lang, 22, 15)} />
              <span>{langMeta.name}</span>
              <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
            </button>
            <button
              type="button"
              className="nb-signin"
              onClick={goToApp}
            >
              {SIGN_IN_LABEL[lang] || SIGN_IN_LABEL.en}
            </button>
            <button type="button" className="nb-cta" onClick={goToApp}>
              Demo
            </button>
          </div>
        </nav>

        <div className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            <span>{t.hb}</span>
          </div>
          <h1 dangerouslySetInnerHTML={{ __html: t.h1 }} />
          <p className="hero-sub">{t.hsub}</p>
          <div className="hero-btns">
            <button type="button" className="btn-primary" onClick={goToApp}>
              {t.cta2}
            </button>
          </div>
          <div className="hero-pills">
            <span className="hero-pill">
              <i className="ti ti-check" />
              <span>{t.hp[2]}</span>
            </span>
          </div>
        </div>

        <div className="lang-strip">
          <div className="lang-strip-track">
            {stripItems.map((l, i) => (
              <span className="strip-item" key={`${l.code}-${i}`}>
                <FlagHtml html={mf(l.code, 22, 15)} /> {l.name}
              </span>
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 40 }}>
          <div className="sec-title">{labels.offers}</div>
          {feedLoading ? (
            <div className="feed-loading">…</div>
          ) : offers.length === 0 ? (
            <div className="feed-empty">{labels.emptyOffers}</div>
          ) : (
            <div className="feed-grid">
              {offers.map((o) => (
                <FeedCard
                  key={String(o.id)}
                  item={o}
                  badge={o.badge || undefined}
                  badgeClass={offerBadgeClass(o.badge)}
                  learnLabel={labels.learn}
                  getItLabel={labels.getIt}
                  onGetIt={goToApp}
                />
              ))}
            </div>
          )}
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="sec-title">{labels.promotions}</div>
          {feedLoading ? (
            <div className="feed-loading">…</div>
          ) : promotions.length === 0 ? (
            <div className="feed-empty">{labels.emptyPromotions}</div>
          ) : (
            <div className="feed-grid">
              {promotions.map((p) => (
                <FeedCard
                  key={String(p.id)}
                  item={p}
                  badge={labels.sponsored}
                  badgeClass="feed-badge-sponsored"
                  learnLabel={labels.learn}
                  getItLabel={labels.getIt}
                  onGetIt={goToApp}
                />
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <div className="sec-label">{t.how_lbl}</div>
          <div className="sec-title">{t.how_ttl}</div>
          <div className="sec-sub">{t.how_sub}</div>
          <div className="how-grid">
            {t.how.map((h) => (
              <div className="how-card" key={h.t}>
                <div className="how-num">{h.ico}</div>
                <div className="how-title">{h.t}</div>
                <div className="how-body">{h.b}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="feat-wrap">
            <div className="sec-label">{t.feat_lbl}</div>
            <div className="sec-title">{t.feat_ttl}</div>
            <div className="sec-sub">{t.feat_sub}</div>
            <div className="feat-grid">
              {t.feats.map((f) => (
                <div className="feat-card" key={f.t}>
                  <div
                    className="feat-icon"
                    style={{ background: f.bg }}
                  >
                    {f.ico}
                  </div>
                  <div>
                    <div className="feat-title">{f.t}</div>
                    <div className="feat-body">{f.b}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="sec-label">{t.pr_lbl}</div>
          <div className="sec-title">{t.pr_ttl}</div>
          <div className="pricing-grid">
            {plans.map((p) => (
              <PlanCard plan={p} key={p.n} />
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="safety-wrap">
            <div className="sec-label">{t.sf_lbl}</div>
            <div className="sec-title">{t.sf_ttl}</div>
            <div className="sec-sub">{t.sf_sub}</div>
            <div className="safety-grid">
              {safety.map((s) => (
                <div className="safety-card" key={s.t}>
                  <div
                    className="safety-card-icon"
                    style={{ background: s.bg }}
                  >
                    {s.ico}
                  </div>
                  <div className="safety-card-title">{s.t}</div>
                  <div className="safety-card-body">{s.b}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="sec-label">{t.faq_lbl}</div>
          <div className="sec-title">{t.faq_ttl}</div>
          <div>
            {t.faqs.map((f, i) => {
              const open = !!openFaqs[i];
              return (
                <div className="faq-item" key={f.q}>
                  <div
                    className={`faq-q${open ? " open" : ""}`}
                    onClick={() => toggleFaq(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleFaq(i);
                    }}
                  >
                    <span>{f.q}</span>
                    <i className="ti ti-chevron-down" />
                  </div>
                  <div className={`faq-a${open ? " open" : ""}`}>{f.a}</div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cta-wrap">
          <h2>{t.cta_h}</h2>
          <p
            dangerouslySetInnerHTML={{
              __html: t.cta_p.replace("\n", "<br>"),
            }}
          />
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 15, padding: "14px 34px" }}
            onClick={goToApp}
          >
            {t.cta2}
          </button>
        </div>

        <div className="footer">
          <div className="footer-logo">
            <img
              src={`${process.env.PUBLIC_URL}/logo192.png`}
              alt="HeyMaa"
            />
            <span className="footer-logo-text">
              Hey<span>Maa</span>
            </span>
          </div>
          <div className="footer-copy">{t.footer}</div>
        </div>
      </div>
    </div>
  );
}
