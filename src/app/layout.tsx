import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "./styles.css";
import "../styles/globals.css";
import "../styles/dashboard-themes.css";
import { cookies } from "next/headers";
import { defaultDashboardTheme, parseTheme, themeCookie } from "@inkspect/core/lib/theme";
import { ChatWindowProvider } from "../components/chat-window-provider";
import { ThemeProvider } from "../components/theme-provider";

import { NotificationProvider } from "../components/notification-toast";

export const metadata: Metadata = {
  title: "Sign in · Inkspect",
  description: "Sign in to your Inkspect account.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const theme = parseTheme((await cookies()).get(themeCookie)?.value) ?? defaultDashboardTheme;
  return <html lang="en"><body data-dashboard-theme={theme}><ThemeProvider savedTheme={theme}><NotificationProvider><ChatWindowProvider><a className="skip-link" href="#main">Skip to content</a>{children}</ChatWindowProvider></NotificationProvider></ThemeProvider></body></html>;
}
