"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { defaultDashboardTheme, themeCookie, type DashboardTheme } from "@inkspect/core/lib/theme";

const ThemeContext = createContext<{ theme: DashboardTheme; setTheme: (theme: DashboardTheme) => void } | null>(null);

export function ThemeProvider({ savedTheme: initialSavedTheme, children }: { savedTheme: DashboardTheme | undefined; children: ReactNode }) {
  const [theme, setSavedTheme] = useState<DashboardTheme>(initialSavedTheme ?? defaultDashboardTheme);
  useEffect(() => { document.body.dataset.dashboardTheme = theme; }, [theme]);
  function setTheme(next: DashboardTheme) {
    // This preference is read on the server so reloads start in the chosen theme.
    document.cookie = `${themeCookie}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setSavedTheme(next);
  }
  return <ThemeContext.Provider value={{ theme, setTheme }}><div data-dashboard-theme={theme}>{children}</div></ThemeContext.Provider>;
}

export function useDashboardTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("ThemeProvider is required.");
  return context;
}
