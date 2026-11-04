import type { SVGProps } from "react";
import type { DashboardSection } from "@inkspect/core/lib/dashboard";

export type DashboardIconName = DashboardSection | "search" | "sidebar-collapse" | "sidebar-expand" | "documentation" | "clipboard" | "upload" | "chat" | "history" | "expand" | "collapse" | "minus" | "share" | "lock" | "trash" | "send" | "findings" | "plus" | "chevron" | "check" | "logout" | "menu" | "close" | "arrow" | "organization";

export function DashboardIcon({ name, ...props }: SVGProps<SVGSVGElement> & { name: DashboardIconName }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>
    {name === "support" && <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="m5.6 5.6 3.6 3.6m5.6 5.6 3.6 3.6m0-12.8-3.6 3.6m-5.6 5.6-3.6 3.6" /></>}
    {name === "search" && <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>}
    {(name === "sidebar-collapse" || name === "sidebar-expand") && <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M9 4v16" /><path d={name === "sidebar-collapse" ? "m16 9-3 3 3 3" : "m14 9 3 3-3 3"} /></>}
    {name === "documentation" && <path d="M3 4h5a4 4 0 0 1 4 4v13a4 4 0 0 0-4-3H3V4Zm9 4a4 4 0 0 1 4-4h5v14h-5a4 4 0 0 0-4 3" />}
    {name === "clipboard" && <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" fill="var(--dash-heading)" /></>}
    {name === "upload" && <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />}
    {name === "chat" && <path d="M20 11a8 8 0 0 1-8 8H7l-4 3v-7a8 8 0 1 1 17-4ZM8 10h8m-8 4h5" />}
    {name === "history" && <><path d="M3 11a9 9 0 1 1 2 7M3 4v7h7" /><path d="M12 7v5l3 2" /></>}
    {name === "expand" && <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />}
    {name === "collapse" && <path d="M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5" />}
    {name === "minus" && <path d="M5 12h14" />}
    {name === "share" && <><circle cx="6" cy="12" r="3" /><circle cx="18" cy="5" r="3" /><circle cx="18" cy="19" r="3" /><path d="m9 10 6-4m-6 8 6 4" /></>}
    {name === "lock" && <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2" /></>}
    {name === "trash" && <><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" /></>}
    {name === "send" && <path d="m4 20 6-17 10 10-16 7Zm0 0 9-9" />}
    {name === "dashboard" && <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>}
    {name === "findings" && <><path d="m12 3 9 16H3L12 3Z" /><path d="M12 9v4m0 3h.01" /></>}
    {name === "reviews" && <><circle cx="6" cy="5" r="2" /><circle cx="6" cy="19" r="2" /><path d="M6 7v10m7-14 3 3-3 3m3-3h1a3 3 0 0 1 3 3v8" /><circle cx="20" cy="19" r="2" /></>}
    {name === "repositories" && <><path d="M5 3h14v18l-7-3-7 3V3Z" /><path d="M9 3v8l3-2 3 2V3" /></>}
    {name === "integrations" && <path d="M8 3v5m8-5v5M6 8h12v4a6 6 0 0 1-12 0V8Zm6 10v3" />}
    {name === "knowledge" && <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></>}
    {name === "members" && <><circle cx="9" cy="8" r="3" /><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m1 4a5 5 0 0 1 3 4v2" /></>}
    {name === "usage" && <><path d="M4 20h16M7 16v-5m5 5V4m5 12V8" /></>}
    {name === "billing" && <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h4" /></>}
    {name === "settings" && <><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="3" fill="var(--dash-panel)" /><circle cx="15" cy="17" r="3" fill="var(--dash-panel)" /></>}
    {name === "organization" && <><path d="M5 21V3h10v18M15 9h5v12M3 21h19M9 7h2M9 11h2M9 15h2" /></>}
    {name === "plus" && <path d="M12 5v14M5 12h14" />}
    {name === "chevron" && <path d="m8 9 4-4 4 4m-8 6 4 4 4-4" />}
    {name === "check" && <path d="m5 12 4 4L19 6" />}
    {name === "logout" && <><path d="M10 4H4v16h6m4-12 4 4-4 4m-6-4h10" /></>}
    {name === "menu" && <path d="M4 6h16M4 12h16M4 18h16" />}
    {name === "close" && <path d="m6 6 12 12M6 18 18 6" />}
    {name === "arrow" && <path d="M5 12h14m-5-5 5 5-5 5" />}
  </svg>;
}
