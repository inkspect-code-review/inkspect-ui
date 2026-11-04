"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { lightSchemeQuery, systemThemes, themeCookie, type DashboardTheme } from "@inkspect/core/lib/theme";

// `theme` is undefined only while hydrating without a saved theme, because the server can't see the OS setting.
const ThemeContext = createContext<{ theme: DashboardTheme | undefined; setTheme: (theme: DashboardTheme) => void } | null>(null);

function subscribe(onChange: () => void) {
  const query = window.matchMedia(lightSchemeQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getSystemTheme() { return window.matchMedia(lightSchemeQuery).matches ? systemThemes.light : systemThemes.dark; }
function getServerSystemTheme() { return undefined; }

export function ThemeProvider({ savedTheme: initialSavedTheme, children }: { savedTheme: DashboardTheme | undefined; children: ReactNode }) {
  const [savedTheme, setSavedTheme] = useState(initialSavedTheme);
  const systemTheme = useSyncExternalStore<DashboardTheme | undefined>(subscribe, getSystemTheme, getServerSystemTheme);
  const theme = savedTheme ?? systemTheme;
  // Until the OS theme is known, <body> keeps the value the root layout's inline script chose.
  useEffect(() => { if (theme) document.body.dataset.dashboardTheme = theme; }, [theme]);
  function setTheme(next: DashboardTheme) {
    // This preference is read on the server so reloads start in the chosen theme.
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setSavedTheme(next);
  }
  // With no attribute the wrapper inherits the body theme instead of overriding it with the server's guess.
  return <ThemeContext.Provider value={{ theme, setTheme }}><div data-dashboard-theme={theme}>{children}</div></ThemeContext.Provider>;
}

export function useDashboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is required.");
  return context;
}
