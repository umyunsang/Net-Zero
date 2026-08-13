import { createContext, type ReactNode, useContext, useEffect, useMemo, useRef, useState } from "react";
import { getStoredLanguage, LANGUAGE_STORAGE_KEY, localeByLanguage, translate, type Language } from "./localization";

type I18nValue = {
  language: Language;
  locale: string;
  setLanguage: (language: Language) => void;
  t: (source: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);
const languageCodes: Record<Language, string> = { th: "TH", en: "EN", ko: "KO" };
const languageOptions: Array<{ value: Language; label: string }> = [
  { value: "th", label: "ไทย" },
  { value: "en", label: "EN" },
  { value: "ko", label: "한국어" },
];

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
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`language-switcher${compact ? " compact" : ""}`}>
      <button
        className="language-trigger"
        type="button"
        aria-label={t("ภาษา")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{languageCodes[language]}</span>
        <svg viewBox="0 0 12 8" aria-hidden="true"><path d="m2 2 4 4 4-4" /></svg>
      </button>
      {open && (
        <div className="language-menu" role="menu" aria-label={t("ภาษา")}>
          {languageOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={language === option.value}
              onClick={() => { setLanguage(option.value); setOpen(false); }}
            >
              <span>{option.label}</span>
              {language === option.value && <span aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
