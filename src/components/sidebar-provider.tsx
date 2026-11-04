"use client";

import type { CSSProperties, ReactNode } from "react";
import { SidebarProvider as ShadcnSidebarProvider } from "./ui/sidebar";

export function SidebarProvider({ initialCollapsed, children }: { initialCollapsed: boolean; children: ReactNode }) {
  return <ShadcnSidebarProvider defaultOpen={!initialCollapsed} style={{ "--sidebar-width": "248px", "--sidebar-width-icon": "64px" } as CSSProperties}>
    {children}
  </ShadcnSidebarProvider>;
}
