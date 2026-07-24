import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { APP_ROUTE } from "../publicRoutes";
import { HM_TOKEN_KEY } from "../lib/authApi";
import {
  HOME_I18N_STORAGE_KEY,
  isHomeLocale,
} from "../i18n";
import type {
  HomeFaqItem,
  HomeHowItem,
  HomePlan,
  HomeTestimonialItem,
} from "../i18n/homeTypes";
import { PlanCard } from "../components/PlanCard";
import { SiteFooter } from "../components/SiteFooter";
import { AUTH_LOGO_SRC } from "../auth/authLogo";
import whatIsImage from "../assets/heymaa-what-is.png";
import { displayUppercase } from "../lib/greekText";
import { LANGS, mf } from "./homeContent";
import "../auth/appAuth.css";
import "./home.css";

const CTA_MOM_IMAGE = `${process.env.PUBLIC_URL}/heymaa-cta-mom.png`;
const MOMENTS_IMAGE = `${process.env.PUBLIC_URL}/heymaa-moments-collage.png`;

const TABLER_ICONS =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

const HERO_VIDEO_SRC =
  "https://experience.babyspace.gr/wp-content/uploads/2024/05/homepage-hero-video.mp4";

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function FlagHtml({ html }: { html: string }) {
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function Home() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const [contentLang, setContentLang] = useState(
    () => localStorage.getItem(HOME_I18N_STORAGE_KEY) || "el"
  );
  const [langOpen, setLangOpen] = useState(false);
  const [openFaqs, setOpenFaqs] = useState<Record<number, boolean>>({});
  const [selectedPlanIndex, setSelectedPlanIndex] = useState<number | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const navbarRef = useRef<HTMLElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);

  const goToApp = useCallback(() => {
    if (localStorage.getItem(HM_TOKEN_KEY)) navigate(APP_ROUTE);
    else navigate(`${APP_ROUTE}/auth`);
  }, [navigate]);

  const howItems = asObjectArray<HomeHowItem>(
    t("how.items", { returnObjects: true })
  );
  const plans = asObjectArray<HomePlan>(
    t("pricing.plans", { returnObjects: true })
  );
  const faqItems = asObjectArray<HomeFaqItem>(
    t("faq.items", { returnObjects: true })
  );
  const testimonialItems = asObjectArray<HomeTestimonialItem>(
    t("testimonial.items", { returnObjects: true })
  );
  const activeTestimonial =
    testimonialItems[testimonialIndex] ?? testimonialItems[0];

  const handlePlanSelect = useCallback((index: number) => {
    const plan = plans[index];
    if (!plan || plan.variant === "current") return;
    setSelectedPlanIndex(index);
  }, [plans]);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TABLER_ICONS;
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  useEffect(() => {
    const navbar = navbarRef.current;
    if (!navbar) return;

    const syncNavbarHeight = () => {
      document.documentElement.style.setProperty(
        "--navbar-height",
        `${navbar.offsetHeight}px`,
      );
    };

    syncNavbarHeight();
    const observer = new ResizeObserver(syncNavbarHeight);
    observer.observe(navbar);
    window.addEventListener("resize", syncNavbarHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", syncNavbarHeight);
    };
  }, []);

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      video.pause();
      return;
    }
    video.play().catch(() => {});
  }, []);

  const langMeta = useMemo(
    () => LANGS.find((l) => l.code === contentLang) || LANGS[0],
    [contentLang]
  );

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

        <nav className="navbar" ref={navbarRef}>
          <div className="nb-logo">
            <div className="nb-logo-mark">
              <img src={AUTH_LOGO_SRC} alt={t("nav.logoAlt")} />
            </div>
            <span className="nb-logo-text">
              Hey<span>Maa</span>
            </span>
          </div>
          <div className="nb-right">
            <button
              type="button"
              className="lang-trigger"
              onClick={() => setLangOpen(true)}
              aria-label={t("langPicker.title")}
            >
              <FlagHtml html={mf(contentLang, 22, 15)} />
              <span className="nb-lang-label">{langMeta.name}</span>
              <i className="ti ti-chevron-down nb-lang-chevron" style={{ fontSize: 11 }} />
            </button>
            <button type="button" className="nb-signin" onClick={goToApp}>
              {t("nav.signIn")}
            </button>
            <button type="button" className="nb-cta" onClick={goToApp}>
              <span className="nb-demo-long">{t("nav.demo")}</span>
              <span className="nb-demo-short">{t("nav.demoShort")}</span>
            </button>
          </div>
        </nav>

        <section className="hero-section" aria-label="Hero">
          <video
            ref={heroVideoRef}
            className="hero-video"
            autoPlay
            muted
            loop
            playsInline
            preload="auto"
            aria-hidden="true"
          >
            <source src={HERO_VIDEO_SRC} type="video/mp4" />
          </video>
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero">
            <div className="app-auth-logo-wrap hero-logo">
              <img src={AUTH_LOGO_SRC} alt={t("nav.logoAlt")} />
            </div>
            <h1 dangerouslySetInnerHTML={{ __html: t("hero.title") }} />
            <p className="hero-sub" dangerouslySetInnerHTML={{ __html: t("hero.subtitle") }} />
            <div className="hero-btns">
              <button type="button" className="btn-primary" onClick={goToApp}>
                {t("hero.cta")}
              </button>
            </div>
          </div>
        </section>

        <section className="hero-below section">
          <p
            className="hero-below-text"
            dangerouslySetInnerHTML={{ __html: t("hero.belowVideoLead") }}
          />
          <div
            className="hero-below-highlight"
            dangerouslySetInnerHTML={{ __html: t("hero.belowVideoHighlight") }}
          />
        </section>

        <section className="what-is section">
          <div className="what-is-grid">
            <div className="what-is-copy">
              <h2 className="sec-title">{t("whatIs.title")}</h2>
              <div
                className="what-is-body"
                dangerouslySetInnerHTML={{ __html: t("whatIs.body") }}
              />
            </div>
            <div className="what-is-media">
              <img src={whatIsImage} alt={t("whatIs.imageAlt")} />
            </div>
          </div>
        </section>

        <div className="section" id="how-section">
          <div className="sec-label">{displayUppercase(t("how.label"), contentLang)}</div>
          <div className="sec-title">{t("how.title")}</div>
          <div className="sec-sub">{t("how.subtitle")}</div>
          <div className="how-grid">
            {howItems.map((item) => (
              <div className="how-card" key={item.title}>
                <div
                  className="how-icon"
                  style={{ background: item.bg, color: item.color }}
                  aria-hidden="true"
                >
                  <i className={`ti ${item.icon}`} />
                </div>
                <div className="how-copy">
                  <div className="how-title">{item.title}</div>
                  <div className="how-lead">{item.lead}</div>
                  <div className="how-body">{item.body}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section story-section">
          <div className="moments-visual">
            <img src={MOMENTS_IMAGE} alt={t("moments.imageAlt")} />
          </div>
          <div className="testimonial-carousel">
            <button
              type="button"
              className="testimonial-nav testimonial-nav-prev"
              aria-label={t("testimonial.prevLabel")}
              onClick={() =>
                setTestimonialIndex(
                  (index) =>
                    (index - 1 + testimonialItems.length) %
                    testimonialItems.length
                )
              }
            >
              <i className="ti ti-chevron-left" aria-hidden="true" />
            </button>
            {activeTestimonial ? (
              <blockquote className="testimonial-card">
                <div
                  className="testimonial-stars"
                  aria-label={t("testimonial.ratingLabel")}
                >
                  ★★★★★
                </div>
                <p className="testimonial-quote">{activeTestimonial.quote}</p>
                <footer className="testimonial-author">
                  <span className="testimonial-avatar" aria-hidden="true">
                    {activeTestimonial.initial}
                  </span>
                  <span className="testimonial-meta">
                    <span className="testimonial-name">
                      {activeTestimonial.name}
                    </span>
                    <span className="testimonial-location">
                      {activeTestimonial.location}
                    </span>
                  </span>
                </footer>
              </blockquote>
            ) : null}
            <button
              type="button"
              className="testimonial-nav testimonial-nav-next"
              aria-label={t("testimonial.nextLabel")}
              onClick={() =>
                setTestimonialIndex(
                  (index) => (index + 1) % testimonialItems.length
                )
              }
            >
              <i className="ti ti-chevron-right" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="section pricing-section">
          <div className="pricing-panel">
            <div className="pricing-panel-header">
              <h2 className="sec-title pricing-panel-title">{t("pricing.title")}</h2>
              <p className="pricing-panel-sub">{t("pricing.subtitle")}</p>
            </div>
            <div className="pricing-panel-body">
              <div className="pricing-cards-layout">
                <div className="pricing-trial-col">
                  {plans.slice(0, 1).map((plan, index) => {
                    const isCurrent = plan.variant === "current";
                    const buttonState = isCurrent
                      ? "current"
                      : selectedPlanIndex === index
                        ? "selected"
                        : "idle";
                    const radioSelected =
                      selectedPlanIndex === index ||
                      (selectedPlanIndex === null && isCurrent);
                    return (
                      <PlanCard
                        plan={plan}
                        key={plan.name}
                        selectMode
                        buttonState={buttonState}
                        radioSelected={radioSelected}
                        onSelect={() => handlePlanSelect(index)}
                      />
                    );
                  })}
                </div>
                <div className="pricing-paid-grid">
                  {plans.slice(1).map((plan, offset) => {
                    const index = offset + 1;
                    const isCurrent = plan.variant === "current";
                    const buttonState = isCurrent
                      ? "current"
                      : selectedPlanIndex === index
                        ? "selected"
                        : "idle";
                    const radioSelected =
                      selectedPlanIndex === index ||
                      (selectedPlanIndex === null && isCurrent);
                    return (
                      <PlanCard
                        plan={plan}
                        key={plan.name}
                        selectMode
                        buttonState={buttonState}
                        radioSelected={radioSelected}
                        onSelect={() => handlePlanSelect(index)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="section faq-section">
          <div className="sec-title">{t("faq.label")}</div>
          <div className="faq-list">
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
          <img
            className="cta-photo"
            src={CTA_MOM_IMAGE}
            alt={t("cta.imageAlt")}
          />
          <div className="cta-copy">
            <p className="cta-line">{t("cta.line1")}</p>
            <p
              className="cta-headline"
              dangerouslySetInnerHTML={{ __html: t("cta.headline") }}
            />
            <p className="cta-line">{t("cta.line3")}</p>
          </div>
          <div className="cta-actions">
            <button type="button" className="cta-btn-primary" onClick={goToApp}>
              {t("cta.button")}
            </button>
          </div>
        </div>

        <SiteFooter contentLang={contentLang} />
      </div>
    </div>
  );
}
