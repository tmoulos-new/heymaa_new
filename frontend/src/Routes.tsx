import React, { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import Home from "./home/Home";
import { AuthPage } from "./pages/AuthPage";
import { AppAuthPage } from "./pages/AppAuthPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CheckoutResultPage } from "./pages/CheckoutResultPage";
import { TermsPage } from "./pages/TermsPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { BrandFavicon } from "./components/BrandFavicon";
import { CookieConsentBanner } from "./components/CookieConsentBanner";
import { SeoHead } from "./components/SeoHead";
import { APP_ROUTE } from "./publicRoutes";
import { hasAuthToken } from "./lib/authApi";
import { analyticsCookiesAllowed } from "./lib/cookieConsent";
import {
  applyConsentDefaultsDenied,
  initGoogleTagManager,
  setDispatchEnabled,
  shouldSkipPageViewPath,
  trackPageView,
} from "./lib/analytics";

const App = lazy(() => import("./App"));

function AppChunkFallback() {
  const isEl = (localStorage.getItem("hm_pre_lang") || "el").toLowerCase().startsWith("el");
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#D4DCE8",
        fontFamily: "'DM Sans', sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center" }}>
        <img
          src="/logo192.png"
          alt=""
          width={52}
          height={52}
          style={{ borderRadius: "50%", marginBottom: 14, display: "block", marginLeft: "auto", marginRight: "auto" }}
        />
        <div style={{ fontSize: 15, color: "#2B3A67", fontWeight: 500 }}>
          {isEl ? "Φόρτωση…" : "Loading…"}
        </div>
      </div>
    </div>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function PublicHome() {
  const [search] = useSearchParams();
  const reset = search.get("reset");
  if (reset) {
    const qs = search.toString();
    return <Navigate to={`${APP_ROUTE}${qs ? `?${qs}` : ""}`} replace />;
  }
  if (hasAuthToken()) {
    return <Navigate to={APP_ROUTE} replace />;
  }
  return <Home />;
}

function AnalyticsConsentGate() {
  const location = useLocation();
  const [analyticsOn, setAnalyticsOn] = useState(false);
  /** Dedupe StrictMode double-invoke; still allow back/forward via location.key. */
  const lastNavKeyRef = useRef<string | null>(null);

  useEffect(() => {
    // Consent Mode defaults as early as possible (denied) before any Google script.
    applyConsentDefaultsDenied();
  }, []);

  const enableAnalytics = useCallback(() => {
    if (!analyticsCookiesAllowed()) return;
    const ok = initGoogleTagManager(location.pathname);
    if (!ok) return;
    setDispatchEnabled(true);
    lastNavKeyRef.current = null;
    setAnalyticsOn(true);
  }, [location.pathname]);

  useEffect(() => {
    if (analyticsCookiesAllowed()) enableAnalytics();
  }, [enableAnalytics]);

  useEffect(() => {
    if (!analyticsOn) return;
    if (shouldSkipPageViewPath(location.pathname, location.search, hasAuthToken())) {
      return;
    }
    // Ignore query-only changes: key includes pathname, not search.
    const navKey = `${location.key}::${location.pathname}`;
    if (lastNavKeyRef.current === navKey) return;
    lastNavKeyRef.current = navKey;
    trackPageView(location.pathname, location.search);
  }, [analyticsOn, location.key, location.pathname, location.search]);

  const onConsentChange = useCallback(
    (analytics: boolean) => {
      if (analytics) {
        lastNavKeyRef.current = null;
        enableAnalytics();
      } else {
        setDispatchEnabled(false);
        setAnalyticsOn(false);
      }
    },
    [enableAnalytics],
  );

  return <CookieConsentBanner onConsentChange={onConsentChange} />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <BrandFavicon />
      <SeoHead />
      <ScrollToTop />
      <AnalyticsConsentGate />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path={`${APP_ROUTE}/auth`} element={<AppAuthPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutResultPage outcome="success" />} />
        <Route path="/checkout/failure" element={<CheckoutResultPage outcome="failure" />} />
        <Route path="/checkout/failed" element={<CheckoutResultPage outcome="failure" />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/" element={<PublicHome />} />
        <Route path="/home" element={<Home />} />
        <Route
          path={`${APP_ROUTE}/*`}
          element={
            <Suspense fallback={<AppChunkFallback />}>
              <App />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
