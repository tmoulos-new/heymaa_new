import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { homeDisplayLocale } from "../i18n";

/** Landing copy tied to the user's picked language (not just global i18n.language). */
export function useLandingI18n(contentLang: string) {
  const landingLng = useMemo(
    () => homeDisplayLocale(contentLang),
    [contentLang],
  );
  const { t: tBase, i18n } = useTranslation();

  const t = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      tBase(key, { ns: "home", lng: landingLng, ...opts }),
    [tBase, landingLng],
  );

  const tSub = useCallback(
    (key: string, opts?: Record<string, unknown>) =>
      i18n.t(key, { ns: "subscription", lng: landingLng, ...opts }),
    [i18n, landingLng],
  );

  useEffect(() => {
    if (i18n.language !== landingLng) {
      void i18n.changeLanguage(landingLng);
    }
  }, [i18n, landingLng]);

  return { t, tSub, landingLng, i18n };
}
