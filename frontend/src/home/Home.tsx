import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { APP_ROUTE } from "../publicRoutes";
import {
  HOME_I18N_STORAGE_KEY,
  isHomeLocale,
} from "../i18n";
import type {
  HomeFaqItem,
  HomeFeatureItem,
  HomeHowItem,
  HomePlan,
  HomeSafetyItem,
} from "../i18n/homeTypes";
import { LANGS, mf } from "./homeContent";
import {
  fetchPublicOffers,
  fetchPublicPromotions,
  type PublicOffer,
  type PublicPromotion,
} from "./homeApi";
import "./home.css";

const TABLER_ICONS =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function offerBadgeClass(badge?: string): string {
  if (badge === "promo") return "feed-badge-promo";
  if (badge === "sponsored") return "feed-badge-sponsored";
  return "feed-badge-offer";
}

function FlagHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

function PlanCard({ plan }: { plan: HomePlan }) {
  return (
    <div
      className={`plan ${plan.variant}`}
      style={{ marginTop: plan.badge ? "14px" : "0" }}
    >
      {plan.badge ? (
        <div className="plan-badge" style={{ background: plan.badgeColor }}>
          {plan.badge}
        </div>
      ) : null}
      <div className="plan-ico">{plan.icon}</div>
      <div className="plan-name">{plan.name}</div>
      <div className="plan-price">{plan.price}</div>
      <div className="plan-period">{plan.period}</div>
      <div className="plan-save">{plan.save || "\u00a0"}</div>
      <ul className="plan-feats">
        {plan.features.map((feature) => (
          <li key={feature}>
            <i className="ti ti-check" />
            {feature}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className={`plan-btn ${plan.buttonClass}`}
        disabled={plan.variant === "current"}
      >
        {plan.button}
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
  item: {
    id: string | number;
    title: string;
    body?: string;
    link?: string | null;
    image_url?: string | null;
  };
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
  const { t, i18n } = useTranslation();
  const [contentLang, setContentLang] = useState(
    () => localStorage.getItem(HOME_I18N_STORAGE_KEY) || "el"
  );
  const [langOpen, setLangOpen] = useState(false);
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({});
  const [offers, setOffers] = useState<PublicOffer[]>([]);
  const [promotions, setPromotions] = useState<PublicPromotion[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);

  const goToApp = useCallback(() => navigate(APP_ROUTE), [navigate]);

  const howItems = asObjectArray<HomeHowItem>(
    t("how.items", { returnObjects: true })
  );
  const featureItems = asObjectArray<HomeFeatureItem>(
    t("features.items", { returnObjects: true })
  );
  const plans = asObjectArray<HomePlan>(
    t("pricing.plans", { returnObjects: true })
  );
  const safetyItems = asObjectArray<HomeSafetyItem>(
    t("safety.items", { returnObjects: true })
  );
  const faqItems = asObjectArray<HomeFaqItem>(
    t("faq.items", { returnObjects: true })
  );

  useEffect(() => {
    let cancelled = false;
    setFeedLoading(true);
    Promise.all([
      fetchPublicOffers(contentLang),
      fetchPublicPromotions(contentLang),
    ])
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
  }, [contentLang]);

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
    () => LANGS.find((l) => l.code === contentLang) || LANGS[0],
    [contentLang]
  );
  const stripItems = useMemo(() => [...LANGS, ...LANGS], []);

  const selectLang = (code: string) => {
    setContentLang(code);
    localStorage.setItem(HOME_I18N_STORAGE_KEY, code);
    if (isHomeLocale(code)) {
      void i18n.changeLanguage(code);
    }
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
              <div className="lang-box-title">{t("langPicker.title")}</div>
              <button
                type="button"
                className="lang-close"
                onClick={() => setLangOpen(false)}
                aria-label={t("nav.close")}
              >
                ✕
              </button>
            </div>
            <div className="flag-grid">
              {LANGS.map((l) => (
                <button
                  type="button"
                  key={l.code}
                  className={`flag-item${l.code === contentLang ? " active" : ""}`}
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
            <img
              src={`${process.env.PUBLIC_URL}/logo192.png`}
              alt={t("nav.logoAlt")}
            />
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
              <FlagHtml html={mf(contentLang, 22, 15)} />
              <span>{langMeta.name}</span>
              <i className="ti ti-chevron-down" style={{ fontSize: 11 }} />
            </button>
            <button type="button" className="nb-signin" onClick={goToApp}>
              {t("nav.signIn")}
            </button>
            <button type="button" className="nb-cta" onClick={goToApp}>
              {t("nav.demo")}
            </button>
          </div>
        </nav>

        <div className="hero">
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            <span>{t("hero.badge")}</span>
          </div>
          <h1 dangerouslySetInnerHTML={{ __html: t("hero.title") }} />
          <p className="hero-sub">{t("hero.subtitle")}</p>
          <div className="hero-btns">
            <button type="button" className="btn-primary" onClick={goToApp}>
              {t("hero.cta")}
            </button>
          </div>
          <div className="hero-pills">
            <span className="hero-pill">
              <i className="ti ti-check" />
              <span>{t("hero.pillLanguages")}</span>
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
          <div className="sec-title">{t("feed.offers")}</div>
          {feedLoading ? (
            <div className="feed-loading">{t("feed.loading")}</div>
          ) : offers.length === 0 ? (
            <div className="feed-empty">{t("feed.emptyOffers")}</div>
          ) : (
            <div className="feed-grid">
              {offers.map((o) => (
                <FeedCard
                  key={String(o.id)}
                  item={o}
                  badge={o.badge || undefined}
                  badgeClass={offerBadgeClass(o.badge)}
                  learnLabel={t("feed.learnMore")}
                  getItLabel={t("feed.getIt")}
                  onGetIt={goToApp}
                />
              ))}
            </div>
          )}
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="sec-title">{t("feed.promotions")}</div>
          {feedLoading ? (
            <div className="feed-loading">{t("feed.loading")}</div>
          ) : promotions.length === 0 ? (
            <div className="feed-empty">{t("feed.emptyPromotions")}</div>
          ) : (
            <div className="feed-grid">
              {promotions.map((p) => (
                <FeedCard
                  key={String(p.id)}
                  item={p}
                  badge={t("feed.sponsored")}
                  badgeClass="feed-badge-sponsored"
                  learnLabel={t("feed.learnMore")}
                  getItLabel={t("feed.getIt")}
                  onGetIt={goToApp}
                />
              ))}
            </div>
          )}
        </div>

        <div className="section">
          <div className="sec-label">{t("how.label")}</div>
          <div className="sec-title">{t("how.title")}</div>
          <div className="sec-sub">{t("how.subtitle")}</div>
          <div className="how-grid">
            {howItems.map((item) => (
              <div className="how-card" key={item.title}>
                <div className="how-num">{item.icon}</div>
                <div className="how-title">{item.title}</div>
                <div className="how-body">{item.body}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="feat-wrap">
            <div className="sec-label">{t("features.label")}</div>
            <div className="sec-title">{t("features.title")}</div>
            <div className="sec-sub">{t("features.subtitle")}</div>
            <div className="feat-grid">
              {featureItems.map((item) => (
                <div className="feat-card" key={item.title}>
                  <div
                    className="feat-icon"
                    style={{ background: item.bg }}
                  >
                    {item.icon}
                  </div>
                  <div>
                    <div className="feat-title">{item.title}</div>
                    <div className="feat-body">{item.body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="sec-label">{t("pricing.label")}</div>
          <div className="sec-title">{t("pricing.title")}</div>
          <div className="pricing-grid">
            {plans.map((plan) => (
              <PlanCard plan={plan} key={plan.name} />
            ))}
          </div>
        </div>

        <div className="section" style={{ paddingTop: 0 }}>
          <div className="safety-wrap">
            <div className="sec-label">{t("safety.label")}</div>
            <div className="sec-title">{t("safety.title")}</div>
            <div className="sec-sub">{t("safety.subtitle")}</div>
            <div className="safety-grid">
              {safetyItems.map((item) => (
                <div className="safety-card" key={item.title}>
                  <div
                    className="safety-card-icon"
                    style={{ background: item.bg }}
                  >
                    {item.icon}
                  </div>
                  <div className="safety-card-title">{item.title}</div>
                  <div className="safety-card-body">{item.body}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="section">
          <div className="sec-label">{t("faq.label")}</div>
          <div className="sec-title">{t("faq.title")}</div>
          <div>
            {faqItems.map((item, i) => {
              const open = !!openFaqs[i];
              return (
                <div className="faq-item" key={item.question}>
                  <div
                    className={`faq-q${open ? " open" : ""}`}
                    onClick={() => toggleFaq(i)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") toggleFaq(i);
                    }}
                  >
                    <span>{item.question}</span>
                    <i className="ti ti-chevron-down" />
                  </div>
                  <div className={`faq-a${open ? " open" : ""}`}>
                    {item.answer}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="cta-wrap">
          <h2>{t("cta.title")}</h2>
          <p dangerouslySetInnerHTML={{ __html: t("cta.body") }} />
          <button
            type="button"
            className="btn-primary"
            style={{ fontSize: 15, padding: "14px 34px" }}
            onClick={goToApp}
          >
            {t("cta.button")}
          </button>
        </div>

        <div className="footer">
          <div className="footer-logo">
            <img
              src={`${process.env.PUBLIC_URL}/logo192.png`}
              alt={t("footer.logoAlt")}
            />
            <span className="footer-logo-text">
              Hey<span>Maa</span>
            </span>
          </div>
          <div className="footer-copy">{t("footer.copy")}</div>
        </div>
      </div>
    </div>
  );
}
