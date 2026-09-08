import React, { useCallback, useEffect, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  useSearchParams,
} from "react-router-dom";
import App from "./App";
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
import { APP_ROUTE } from "./publicRoutes";
import { hasAuthToken } from "./lib/authApi";
import reportWebVitals from "./reportWebVitals";
import { analyticsCookiesAllowed } from "./lib/cookieConsent";
import { initGoogleAnalytics, trackPageView } from "./lib/gtag";

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
  const [analyticsOn, setAnalyticsOn] = useState(() => analyticsCookiesAllowed());

  const enableAnalytics = useCallback(() => {
    initGoogleAnalytics();
    setAnalyticsOn(true);
    reportWebVitals((metric) => {
      if (typeof window.gtag !== "function") return;
      window.gtag("event", metric.name, {
        event_category: "Web Vitals",
        value: Math.round(metric.name === "CLS" ? metric.delta * 1000 : metric.delta),
        event_label: metric.id,
        non_interaction: true,
      });
    });
  }, []);

  useEffect(() => {
    if (analyticsCookiesAllowed()) enableAnalytics();
  }, [enableAnalytics]);

  useEffect(() => {
    if (!analyticsOn) return;
    trackPageView(`${location.pathname}${location.search}`);
  }, [analyticsOn, location.pathname, location.search]);

  const onConsentChange = useCallback(
    (analytics: boolean) => {
      if (analytics) enableAnalytics();
    },
    [enableAnalytics],
  );

  return <CookieConsentBanner onConsentChange={onConsentChange} />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <BrandFavicon />
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
        <Route path={`${APP_ROUTE}/*`} element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
