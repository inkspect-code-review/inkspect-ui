"use client";
import { SelfHostedUsagePanel as UsagePanel } from "./usage-panel";
import { DashboardShell, type DashboardShellProps, type DashboardPanels } from "../components/dashboard-shell";
import { DashboardEditionProvider } from "../components/dashboard-edition";
import { selfHostedDashboardEdition } from "@inkspect/core/lib/dashboard-edition";
import { MembersPanel } from "../components/members-panel";

const panels = { MembersPanel, UsagePanel } satisfies DashboardPanels;
export function SelfHostedDashboard(props: DashboardShellProps) {
  return <DashboardEditionProvider value={selfHostedDashboardEdition}><DashboardShell {...props} panels={panels} /></DashboardEditionProvider>;
}
