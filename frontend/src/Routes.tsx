import React from "react";
import { BrowserRouter, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import App from "./App";
import Home from "./home/Home";
import { APP_ROUTE } from "./publicRoutes";

const TOKEN_KEY = "hm_token";

function PublicHome() {
  const [search] = useSearchParams();
  const reset = search.get("reset");
  if (reset) {
    const qs = search.toString();
    return <Navigate to={`${APP_ROUTE}${qs ? `?${qs}` : ""}`} replace />;
  }
  if (localStorage.getItem(TOKEN_KEY)) {
    return <Navigate to={APP_ROUTE} replace />;
  }
  return <Home />;
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicHome />} />
        <Route path="/home" element={<Home />} />
        <Route path={`${APP_ROUTE}/*`} element={<App />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
