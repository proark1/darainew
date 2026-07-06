import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  EN_TRANSLATIONS,
  type Language,
  loadTranslations,
  SUPPORTED_LANGUAGES,
  translate,
  type TranslationBundle,
} from "@/i18n";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const STORAGE_KEY = "app-language";
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

function readInitialLanguage(): Language {
  if (typeof window === "undefined") return "en";
  const saved = window.localStorage.getItem(STORAGE_KEY);
  return SUPPORTED_LANGUAGES.includes(saved as Language) ? (saved as Language) : "en";
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readInitialLanguage);
  const [messages, setMessages] = useState<TranslationBundle>(EN_TRANSLATIONS);

  useEffect(() => {
    let cancelled = false;

    void loadTranslations(language)
      .then((loadedMessages) => {
        if (!cancelled) setMessages(loadedMessages);
      })
      .catch(() => {
        if (!cancelled) setMessages(EN_TRANSLATIONS);
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // Private-browsing / quota: tolerate.
    }
  }, []);

  const t = useCallback((key: string) => translate(messages, key), [messages]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within a LanguageProvider");
  return ctx;
}

// Re-export Language so existing imports from "@/contexts/LanguageContext"
// keep working without a sweep.
export type { Language };
