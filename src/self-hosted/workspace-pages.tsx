import { createWorkspacePages } from "../lib/workspace-pages";
import { getSelfHostedAuth } from "@inkspect/core/self-hosted/auth-runtime";
import { SelfHostedDashboard } from "./dashboard";
import { selfHostedDashboardEdition } from "@inkspect/core/lib/dashboard-edition";
import { selfHostedAuthPolicy } from "@inkspect/core/self-hosted/auth";

export const { DashboardPage, OnboardingPage, WorkspaceLayout } = createWorkspacePages({
  getAuth: getSelfHostedAuth, Dashboard: SelfHostedDashboard, edition: selfHostedDashboardEdition,
  canCreateOrganization: selfHostedAuthPolicy.canCreateOrganization,
});
