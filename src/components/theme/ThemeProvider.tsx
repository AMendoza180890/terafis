"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import { setStaffThemeAction } from "@/lib/theme/actions";
import {
  resolveColorScheme,
  resolveThemePreference,
  type ColorScheme,
} from "@/lib/theme/resolution";
import type { ThemePreference } from "@/lib/roles";

type ThemeContextValue = {
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
  isDark: boolean;
  isSystem: boolean;
  colorScheme: ColorScheme;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyHtmlClass(scheme: ColorScheme) {
  const root = document.documentElement;
  if (scheme === "oscuro") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function ThemeProvider({
  children,
  staffPreference,
  clinicDefault,
  initialScheme,
}: {
  children: React.ReactNode;
  staffPreference: ThemePreference;
  clinicDefault: ThemePreference;
  initialScheme: ColorScheme | null;
}) {
  const [theme, setThemeState] = useState<ThemePreference>(staffPreference);
  const [systemDark, setSystemDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [, startTransition] = useTransition();

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setSystemDark(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const resolved = useMemo(() => {
    const pref = resolveThemePreference(theme, clinicDefault);
    return resolveColorScheme(pref, systemDark);
  }, [theme, clinicDefault, systemDark]);

  useEffect(() => {
    applyHtmlClass(resolved);
  }, [resolved]);

  // Primera hidratación: respetar esquema SSR si existe
  useEffect(() => {
    if (initialScheme) applyHtmlClass(initialScheme);
  }, [initialScheme]);

  const setTheme = useCallback(
    (t: ThemePreference) => {
      setThemeState(t);
      const next =
        t === "claro" || t === "oscuro"
          ? t
          : clinicDefault === "claro" || clinicDefault === "oscuro"
            ? clinicDefault
            : resolveColorScheme("sistema", systemDark);
      applyHtmlClass(next);
      startTransition(() => {
        void setStaffThemeAction(t);
      });
    },
    [clinicDefault, systemDark],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      setTheme,
      isDark: resolved === "oscuro",
      isSystem: theme === "sistema",
      colorScheme: resolved,
    }),
    [theme, setTheme, resolved],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de ThemeProvider");
  }
  return ctx;
}
