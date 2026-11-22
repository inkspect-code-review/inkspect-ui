import { selfHostedDashboardEdition, type DashboardEdition } from "@inkspect/core/lib/dashboard-edition";

export const dashboardEdition: DashboardEdition = {
  ...selfHostedDashboardEdition,
  navigation: selfHostedDashboardEdition.navigation.map(group => ({
    ...group, sections: group.sections.filter(id => id !== "usage"),
  })),
  accountSections: ["settings", "usage"],
};
