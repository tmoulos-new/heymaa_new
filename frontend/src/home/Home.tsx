import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";
import { APP_ROUTE } from "../publicRoutes";
import {
  fetchSubscriptionStatus,
  getAuthToken,
  hasAuthToken,
  type SubscriptionSnapshot,
} from "../lib/authApi";
import {
  HOME_I18N_STORAGE_KEY,
} from "../i18n";
import { normalizeAppLang, writeStoredAppLang } from "../lib/appLang";
import type {
  HomeFaqItem,
  HomeHowItem,
  HomeInsideExtra,
  HomeInsideItem,
  HomePlan,
  HomeSafetyItem,
  HomeTestimonialItem,
} from "../i18n/homeTypes";
import { PlanCard } from "../components/PlanCard";
import { FaqAccordionList } from "../components/FaqAccordionList";
import { useFaqAccordion } from "../lib/useFaqAccordion";
import { SiteFooter } from "../components/SiteFooter";
import { SiteNavbarLogo } from "../components/SiteNavbarLogo";
import { AUTH_LOGO_SRC } from "../auth/authLogo";
import whatIsImage from "../assets/heymaa-what-is.jpg";
import heroPosterImage from "../assets/heymaa-hero-poster.jpg";
import ctaMomImage from "../assets/heymaa-cta-mom.png";
import momentsExpecting from "../assets/heymaa-moment-expecting.jpg";
import momentsNight from "../assets/heymaa-moment-night.jpg";
import momentsPlay from "../assets/heymaa-moment-play.jpg";
import phoneChat from "../assets/heymaa-phone-chat.png";
import phoneMemories from "../assets/heymaa-phone-memories.png";
import phoneFamily from "../assets/heymaa-phone-family.png";
import phoneMilestones from "../assets/heymaa-phone-milestones.png";
import { displayUppercase } from "../lib/greekText";
import { continueWithPlan, setPlanIntent } from "../lib/planCheckoutFlow";
import {
  applySubscriptionPlanState,
  displaySelectedPlanSlot,
  indexForPlanSlot,
  slotForPlanIndex,
} from "../lib/subscriptionPlans";
import { LANGS } from "./homeContent";
import { LanguageFlagOverlay, LanguageTriggerCode } from "../components/LanguageFlagPicker";
import { useLandingI18n } from "../lib/useLandingI18n";
import "../auth/appAuth.css";
import "./home.css";

const INSIDE_IMAGES: Record<string, string> = {
  chat: phoneChat,
  memories: phoneMemories,
  family: phoneFamily,
  milestones: phoneMilestones,
};

const HOW_PHOTOS = [
  { src: momentsExpecting, altKey: "moments.altExpecting" },
  { src: momentsPlay, altKey: "moments.altPlay" },
  { src: momentsNight, altKey: "moments.altNight" },
] as const;

const TABLER_ICONS =
  "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css";

const HERO_VIDEO_SRC =
  "https://experience.babyspace.gr/wp-content/uploads/2024/05/homepage-hero-video.mp4";

/** iPhone/iPad (incl. in-app browsers) — muted autoplay is unreliable; use a still frame. */
function prefersStaticHeroMedia(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod|iPad/i.test(ua)) return true;
  // iPadOS 13+ can report as MacIntel with touch
  if (navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1) {
    return true;
  }
  try {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function asObjectArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export default function Home() {
  const navigate = useNavigate();
  const [contentLang, setContentLang] = useState(
    () => normalizeAppLang(localStorage.getItem(HOME_I18N_STORAGE_KEY) || "el", "el")
  );
  const { t, tSub, landingLng } = useLandingI18n(contentLang);
  const [langOpen, setLangOpen] = useState(false);
  const { openIndex: openFaqIndex, setOpenIndex: setOpenFaqIndex } = useFaqAccordion(null);
  const [selectedPlanIndex, setSelectedPlanIndex] = useState(0);
  const [userPickedPlan, setUserPickedPlan] = useState(false);
  const [snapshot, setSnapshot] = useState<SubscriptionSnapshot | null>(null);
  const [testimonialIndex, setTestimonialIndex] = useState(0);
  const navbarRef = useRef<HTMLElement>(null);
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [staticHero] = useState(() => prefersStaticHeroMedia());
  const token = getAuthToken();

  const goToApp = useCallback(() => {
    if (hasAuthToken()) navigate(APP_ROUTE);
    else navigate(`${APP_ROUTE}/auth`);
  }, [navigate]);

  const goToLogin = useCallback(() => {
    if (hasAuthToken()) navigate(APP_ROUTE);
    else navigate(`${APP_ROUTE}/auth?mode=login`);
  }, [navigate]);

  const howItems = asObjectArray<HomeHowItem>(
    t("how.items", { returnObjects: true })
  );
  const insideItems = asObjectArray<HomeInsideItem>(
    t("inside.items", { returnObjects: true })
  );
  const insideExtras = asObjectArray<HomeInsideExtra>(
    t("inside.extras", { returnObjects: true })
  );
  const safetyItems = asObjectArray<HomeSafetyItem>(
    t("safety.items", { returnObjects: true })
  );
  const featuredInside = insideItems.find((item) => item.id === "chat");
  const insideCards = insideItems.filter((item) => item.id !== "chat");
  const basePlans = asObjectArray<HomePlan>(
    t("pricing.plans", { returnObjects: true })
  );
  const plans = useMemo(
    () =>
      applySubscriptionPlanState(
        basePlans,
        snapshot,
        {
          currentBadge: tSub("plan.currentBadge"),
          currentButton: tSub("plan.currentButton"),
          expiredBadge: tSub("trial.expiredBadge"),
          expiredButton: tSub("trial.expiredButton"),
          signupButton: tSub("trial.signupButton"),
        },
        !!token,
      ),
    [basePlans, snapshot, tSub, token],
  );
  const currentPlanIndex = indexForPlanSlot(displaySelectedPlanSlot(snapshot));
  const faqItems = useMemo(
    () => asObjectArray<HomeFaqItem>(t("faq.landingItems", { returnObjects: true })),
    [t],
  );
  const testimonialItems = asObjectArray<HomeTestimonialItem>(
    t("testimonial.items", { returnObjects: true })
  );
  const activeTestimonial =
    testimonialItems[testimonialIndex] ?? testimonialItems[0];

  const handlePlanRadioSelect = useCallback((index: number) => {
    const slot = slotForPlanIndex(index);
    setUserPickedPlan(true);
    setSelectedPlanIndex(index);
    setPlanIntent(slot);
  }, []);

  const handlePlanContinue = useCallback((index: number) => {
    const slot = slotForPlanIndex(index);
    setUserPickedPlan(true);
    setSelectedPlanIndex(index);
    continueWithPlan(slot, navigate);
  }, [navigate]);

  useEffect(() => {
    if (!token) {
      setSnapshot(null);
      return;
    }
    let cancelled = false;
    fetchSubscriptionStatus(token)
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch(() => {
        if (!cancelled) setSnapshot(null);
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (!userPickedPlan) setSelectedPlanIndex(currentPlanIndex);
  }, [currentPlanIndex, userPickedPlan]);

  useEffect(() => {
    document.title = "HeyMaa";
  }, []);

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

  useLayoutEffect(() => {
    if (staticHero) return;
    const video = heroVideoRef.current;
    if (!video) return;

    const arm = () => {
      video.muted = true;
      video.defaultMuted = true;
      video.volume = 0;
      video.playsInline = true;
      video.setAttribute("muted", "");
      video.setAttribute("playsinline", "");
      video.setAttribute("webkit-playsinline", "true");
      video.setAttribute("x5-playsinline", "true");
    };

    let playQueued = false;
    const tryPlay = () => {
      if (!video || video.paused === false) return;
      video.muted = true;
      video.playsInline = true;
      const playAttempt = video.play();
      if (playAttempt) {
        playAttempt.catch(() => {
          if (playQueued) return;
          playQueued = true;
        });
      }
    };

    arm();
    // Defer first play to next frame — more reliable on cold start
    const raf = window.requestAnimationFrame(() => tryPlay());

    const mediaEvents = ["loadedmetadata", "loadeddata", "canplay", "canplaythrough", "suspend"] as const;
    mediaEvents.forEach((eventName) => video.addEventListener(eventName, tryPlay));

    const onVisible = () => {
      if (document.visibilityState === "visible") tryPlay();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", tryPlay);
    window.addEventListener("focus", tryPlay);

    const gestureEvents = ["touchstart", "touchend", "pointerdown", "click"] as const;
    const onGesture = () => tryPlay();
    gestureEvents.forEach((eventName) =>
      window.addEventListener(eventName, onGesture, { capture: true, passive: true }),
    );

    return () => {
      window.cancelAnimationFrame(raf);
      mediaEvents.forEach((eventName) => video.removeEventListener(eventName, tryPlay));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", tryPlay);
      window.removeEventListener("focus", tryPlay);
      gestureEvents.forEach((eventName) =>
        window.removeEventListener(eventName, onGesture, true),
      );
    };
  }, [staticHero]);

  const langMeta = useMemo(
    () => LANGS.find((l) => l.code === contentLang) || LANGS[0],
    [contentLang]
  );

  const selectLang = (code: string) => {
    const normalized = writeStoredAppLang(code);
    setContentLang(normalized);
    setLangOpen(false);
    setOpenFaqIndex(null);
  };

  return (
    <div id="landing-page">
      <div id="page" dir={langMeta.rtl ? "rtl" : "ltr"}>
        <LanguageFlagOverlay
          open={langOpen}
          title={t("langPicker.title")}
          currentLang={contentLang}
          onClose={() => setLangOpen(false)}
          onSelect={selectLang}
          raised
          searchPlaceholder={t("langPicker.search")}
          selectLabel={t("langPicker.select")}
          emptyLabel={t("langPicker.empty")}
        />

        <nav className="navbar" ref={navbarRef}>
          <SiteNavbarLogo alt={t("nav.logoAlt")} />
          <div className="nb-right">
            <button
              type="button"
              className="lang-trigger"
              onClick={() => setLangOpen(true)}
              aria-label={t("langPicker.title")}
            >
              <LanguageTriggerCode code={contentLang} />
              <span className="nb-lang-label">{langMeta.name}</span>
              <i className="ti ti-chevron-down nb-lang-chevron" style={{ fontSize: 11 }} />
            </button>
            <button type="button" className="nb-signin" onClick={goToLogin}>
              {t("nav.signIn")}
            </button>
            <button type="button" className="nb-cta" onClick={goToApp}>
              <span className="nb-demo-long">{t("nav.demo")}</span>
              <span className="nb-demo-short">{t("nav.demoShort")}</span>
            </button>
          </div>
        </nav>

        <section className="hero-section" aria-label="Hero">
          <div className="hero-video-wrap">
            {staticHero ? (
              <img
                src={heroPosterImage}
                alt=""
                className="hero-video hero-video--static"
                decoding="async"
                fetchPriority="high"
                aria-hidden="true"
              />
            ) : (
              <video
                ref={heroVideoRef}
                className="hero-video"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster={heroPosterImage}
                disablePictureInPicture
                disableRemotePlayback
                aria-hidden="true"
              >
                <source src={HERO_VIDEO_SRC} type="video/mp4" />
              </video>
            )}
          </div>
          <div className="hero-overlay" aria-hidden="true" />
          <div className="hero">
            <div className="app-auth-logo-wrap hero-logo">
              <img src={AUTH_LOGO_SRC} alt={t("nav.logoAlt")} />
            </div>
            <h1 dangerouslySetInnerHTML={{ __html: t("hero.title") }} />
            <p className="hero-sub" dangerouslySetInnerHTML={{ __html: t("hero.subtitle") }} />
            <div className="hero-btns">
              <button type="button" className="cta-btn-primary" onClick={goToApp}>
                {t("hero.cta")}
              </button>
            </div>
          </div>
        </section>

        <section className="what-is section">
          <div className="what-is-panel">
            <div className="what-is-grid">
              <div className="what-is-copy">
                <h2 className="sec-title">{t("whatIs.title")}</h2>
                <p
                  className="what-is-body"
                  dangerouslySetInnerHTML={{ __html: t("whatIs.body") }}
                />
                <ul className="what-is-modes">
                  {howItems.map((item) => (
                    <li className="what-is-mode" key={item.title}>
                      <span
                        className="what-is-mode-icon"
                        style={{ background: item.bg, color: item.color }}
                        aria-hidden="true"
                      >
                        <i className={`ti ${item.icon}`} />
                      </span>
                      {item.title}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="what-is-media">
                <img src={whatIsImage} alt={t("whatIs.imageAlt")} />
              </div>
            </div>
          </div>
        </section>

        <div className="section" id="how-section">
          {t("how.label") && <div className="sec-label">{displayUppercase(t("how.label"), contentLang)}</div>}
          <div className="sec-title">{t("how.title")}</div>
          <div className="sec-sub">{t("how.subtitle")}</div>
          <div className="how-grid">
            {howItems.map((item, index) => {
              const photo = HOW_PHOTOS[index];
              return (
              <div className="how-card" key={item.title}>
                {photo ? (
                  <div className="how-photo">
                    <img src={photo.src} alt={t(photo.altKey)} />
                  </div>
                ) : null}
                <div className="how-card-body">
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
              </div>
              );
            })}
          </div>
        </div>

        <section className="section inside-section" id="inside-section" aria-labelledby="inside-title">
          {t("inside.label") && (
            <div className="sec-label">{displayUppercase(t("inside.label"), contentLang)}</div>
          )}
          <h2 className="sec-title" id="inside-title">{t("inside.title")}</h2>
          <p className="sec-sub">{t("inside.subtitle")}</p>
          {featuredInside ? (
            <div className="inside-featured">
              <div className="inside-featured-copy">
                <h3 className="inside-card-title">{featuredInside.title}</h3>
                <p className="inside-card-body">{featuredInside.body}</p>
              </div>
              <div className="inside-phone">
                <img
                  src={INSIDE_IMAGES[featuredInside.id]}
                  alt={featuredInside.imageAlt}
                />
              </div>
            </div>
          ) : null}
          <div className="inside-grid">
            {insideCards.map((item) => (
              <article className="inside-card" key={item.id}>
                <h3 className="inside-card-title">{item.title}</h3>
                <p className="inside-card-body">{item.body}</p>
                <div className="inside-phone inside-phone--card">
                  <img src={INSIDE_IMAGES[item.id]} alt={item.imageAlt} />
                </div>
              </article>
            ))}
          </div>
          {insideExtras.length > 0 ? (
            <div className="inside-extras">
              {insideExtras.map((extra) => (
                <article className="inside-extra" key={extra.title}>
                  <div className="inside-extra-icon" aria-hidden="true">
                    <i className={`ti ${extra.icon}`} />
                  </div>
                  <div className="inside-extra-copy">
                    <h3 className="inside-card-title">{extra.title}</h3>
                    <p className="inside-card-body">{extra.body}</p>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </section>

        <div className="section story-section">
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
                <div className="testimonial-copy">
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
                </div>
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
              <div className="pricing-cards-grid">
                {plans.map((plan, index) => {
                  const radioSelected = selectedPlanIndex === index;
                  const isCurrentPlan = plan.variant === "current";
                  const buttonState = isCurrentPlan
                    ? "current"
                    : radioSelected
                      ? "selected"
                      : "idle";
                  return (
                    <PlanCard
                      plan={plan}
                      key={plan.name}
                      selectMode
                      buttonState={buttonState}
                      radioSelected={radioSelected}
                      onSelect={() => handlePlanRadioSelect(index)}
                      onButtonClick={() => handlePlanContinue(index)}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <section className="section safety-section" aria-labelledby="safety-title">
          <h2 className="sec-title" id="safety-title">{t("safety.title")}</h2>
          <p className="sec-sub">{t("safety.subtitle")}</p>
          <div className="safety-grid">
            {safetyItems.map((item) => (
              <article className="safety-card" key={item.text}>
                <div className="safety-icon" aria-hidden="true">
                  <i className={`ti ${item.icon}`} />
                </div>
                <p className="safety-text">{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <div className="section faq-section">
          <div className="sec-title">{t("faq.label")}</div>
          <FaqAccordionList
            items={faqItems}
            openIndex={openFaqIndex}
            onOpenIndexChange={setOpenFaqIndex}
            idPrefix="landing-faq"
          />
        </div>

        <section className="cta-section section" aria-label={t("cta.button")}>
          <div className="cta-wrap">
            <img
              className="cta-photo"
              src={ctaMomImage}
              alt={t("cta.imageAlt")}
            />
            <div className="cta-copy">
              <p className="cta-line">{t("cta.line1")}</p>
              <p
                className="cta-headline"
                dangerouslySetInnerHTML={{ __html: t("cta.headline") }}
              />
              <p
                className="cta-line cta-line-end"
                dangerouslySetInnerHTML={{ __html: t("cta.line3") }}
              />
            </div>
            <div className="cta-actions">
              <button type="button" className="cta-btn-primary" onClick={goToApp}>
                {t("cta.button")}
              </button>
            </div>
          </div>
        </section>

        <SiteFooter contentLang={contentLang} landingLng={landingLng} />
      </div>
    </div>
  );
}
