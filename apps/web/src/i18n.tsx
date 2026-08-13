import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { getStoredLanguage, LANGUAGE_STORAGE_KEY, localeByLanguage, translate, type Language } from "./localization";

type I18nValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(getStoredLanguage);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  }, [language]);

  const value = useMemo<I18nValue>(() => ({
    language,
    locale: localeByLanguage[language],
    setLanguage: setLanguageState,
    t: (source, values) => translate(language, source, values),
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("I18nProvider is missing");
  return value;
}

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { language, setLanguage, t } = useI18n();
  return (
    <label className={`language-switcher${compact ? " compact" : ""}`}>
      <span className="sr-only">{t("ภาษา")}</span>
      <select aria-label={t("ภาษา")} value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
        <option value="th">ไทย</option>
        <option value="en">EN</option>
        <option value="ko">한국어</option>
      </select>
    </label>
  );
}
