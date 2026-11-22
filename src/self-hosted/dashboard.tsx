"use client";
import { SelfHostedUsagePanel as UsagePanel } from "./usage-panel";
import { DashboardShell, type DashboardShellProps, type DashboardPanels } from "../components/dashboard-shell";
import { DashboardEditionProvider } from "../components/dashboard-edition";
import { dashboardEdition } from "./dashboard-edition";
import { MembersPanel } from "../components/members-panel";

import { ProfileName, accountSections } from "./account-settings";
import { SettingsWorkspace, PersonalSettings } from "../components/settings-workspace";

const panels = {
  MembersPanel, UsagePanel,
  SettingsWorkspace: props => <SettingsWorkspace {...props} accountFields={<ProfileName name={props.user.name} />} additionalSections={accountSections} />,
  PersonalSettings: props => <PersonalSettings {...props} accountFields={<ProfileName name={props.user.name} />} additionalSections={accountSections} />,
} satisfies DashboardPanels;
export function SelfHostedDashboard(props: DashboardShellProps) {
  return <DashboardEditionProvider value={dashboardEdition}><DashboardShell {...props} panels={panels} /></DashboardEditionProvider>;
}
