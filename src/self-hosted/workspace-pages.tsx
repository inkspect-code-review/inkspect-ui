import { createWorkspacePages } from "../lib/workspace-pages";
import { getSelfHostedAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { SelfHostedDashboard } from "./dashboard";
import { dashboardEdition } from "./dashboard-edition";
import { selfHostedAuthPolicy } from "@inkspect/core/self-hosted/auth";

export const { DashboardPage, OnboardingPage, WorkspaceLayout } = createWorkspacePages({
  getAuth: getSelfHostedAuth, Dashboard: SelfHostedDashboard, edition: dashboardEdition,
  canCreateOrganization: selfHostedAuthPolicy.canCreateOrganization,
});
