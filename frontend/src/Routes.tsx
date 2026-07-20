import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import App from "./App";
import Home from "./home/Home";
import { AuthPage } from "./pages/AuthPage";
import { AppAuthPage } from "./pages/AppAuthPage";
import { SubscriptionPage } from "./pages/SubscriptionPage";
import { CheckoutPage } from "./pages/CheckoutPage";
import { CheckoutResultPage } from "./pages/CheckoutResultPage";
import { APP_ROUTE } from "./publicRoutes";
import { HM_TOKEN_KEY } from "./lib/authApi";

function PublicHome() {
  const [search] = useSearchParams();
  const reset = search.get("reset");
  if (reset) {
    const qs = search.toString();
    return <Navigate to={`${APP_ROUTE}${qs ? `?${qs}` : ""}`} replace />;
  }
  if (localStorage.getItem(HM_TOKEN_KEY)) {
    return <Navigate to={APP_ROUTE} replace />;
  }
  return <Home />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path={`${APP_ROUTE}/auth`} element={<AppAuthPage />} />
        <Route path="/subscription" element={<SubscriptionPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/success" element={<CheckoutResultPage outcome="success" />} />
        <Route path="/checkout/failure" element={<CheckoutResultPage outcome="failure" />} />
        <Route path="/checkout/failed" element={<CheckoutResultPage outcome="failure" />} />
        <Route path="/" element={<PublicHome />} />
        <Route path="/home" element={<Home />} />
        <Route path={`${APP_ROUTE}/*`} element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
