import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./styles.css";
import "../styles/globals.css";
import "../styles/dashboard-themes.css";
import { cookies } from "next/headers";
import { parseTheme, systemThemes, systemThemeScript, themeCookie } from "@inkspect/core/lib/theme";
import { ChatWindowProvider } from "../components/chat-window-provider";
import { ThemeProvider } from "../components/theme-provider";

export const metadata: Metadata = {
  title: "Sign in · Inkspect",
  description: "Sign in to your Inkspect account.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const savedTheme = parseTheme((await cookies()).get(themeCookie)?.value);
  // Without a saved theme the OS color scheme decides; the inline script applies it before the first paint.
  return <html lang="en"><body data-dashboard-theme={savedTheme ?? systemThemes.dark} suppressHydrationWarning>{!savedTheme && <script dangerouslySetInnerHTML={{ __html: systemThemeScript }} />}<ThemeProvider savedTheme={savedTheme}><ChatWindowProvider><a className="skip-link" href="#main">Skip to content</a>{children}</ChatWindowProvider></ThemeProvider></body></html>;
}
