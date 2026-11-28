import { resolveDashboardSection, type DashboardEdition } from "@inkspect/core/lib/dashboard-edition";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { workspaceStatus } from "@inkspect/core/lib/workspace-status";
import { workspaceHomeHref, type DashboardMember } from "@inkspect/core/lib/dashboard";
import { parseGitHubError } from "@inkspect/core/lib/github-errors";
import { workspaceLogoStorageReady } from "@inkspect/core/lib/workspace-logo-storage";
import { signInMethodSummary } from "@inkspect/core/lib/login-providers";


import type { ComponentType, ReactNode } from "react";
import { cookies } from "next/headers";
import type { Auth, Repository } from "@inkspect/core/lib/github";
import { createSessionHelpers } from "@inkspect/core/lib/session";
import type { DashboardShellProps } from "../components/dashboard-shell";
import { WorkspaceChat } from "../components/workspace-chat";
import { SidebarProvider } from "../components/sidebar-provider";
import { sidebarCookie } from "@inkspect/core/lib/sidebar";

export function createWorkspacePages({ getAuth, Dashboard, edition, canCreateOrganization, dashboardExtras, additionalChatRepositories, memberSections = ["members", "usage"] }: {
  getAuth: () => Auth; Dashboard: ComponentType<DashboardShellProps>; edition: DashboardEdition;
  canCreateOrganization: (user: { id: string; emailVerified: boolean }) => boolean | Promise<boolean>;
  memberSections?: readonly string[];
  additionalChatRepositories?: (organizationId: string, userId: string) => Promise<Repository[]>;
  dashboardExtras?: (query: { reason?: string | string[]; repository?: string | string[] }) => Partial<DashboardShellProps>;
}) {
  const { requireSession } = createSessionHelpers(getAuth);
async function DashboardPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[]; reason?: string | string[]; repository?: string | string[]; error?: string | string[]; connected?: string | string[] }>;
}) {
  const session = await requireSession();
  const requestHeaders = await headers();
  const { view, error, connected, reason, repository } = await searchParams;
  const section = resolveDashboardSection(edition, view);
  const auth = getAuth();
  const organizations = (await auth.api.listOrganizations({ headers: requestHeaders }))
    .map(({ id, name, slug, logo }) => ({ id, name, slug, logo }));
  // Resolve the selected organization only from this user's current memberships.
  const active = organizations.find((org) => org.id === session.session.activeOrganizationId) ?? null;
  const github = active ? await workspaceStatus(active.id, session.user.id, getAuth()) : undefined;
  if (!view && workspaceHomeHref(github) === "/onboarding") redirect("/onboarding");
  const summary = active && section === "dashboard" ? {
    memberCount: await (await auth.$context).adapter.count({ model: "member", where: [{ field: "organizationId", value: active.id }] }),
    asOf: new Date().toISOString(),
  } : undefined;
  let members: DashboardMember[] = [];
  if (active && memberSections.includes(section)) {
    const organization = await auth.api.getFullOrganization({
      headers: requestHeaders,
      query: { organizationId: active.id, membersLimit: 100 },
    });
    members = organization?.members.map((member) => ({
      id: member.userId, name: member.user.name, email: member.user.email, role: member.role,
    })) ?? [];
  }
  const canCreate = await canCreateOrganization(session.user);
  const signInMethods = section === "settings" ? signInMethodSummary(
    await auth.api.listUserAccounts({ headers: requestHeaders }),
    Object.keys(auth.options.socialProviders ?? {}),
  ) : undefined;
  return <Dashboard {...dashboardExtras?.({ reason, repository })} logoUploadsEnabled={workspaceLogoStorageReady()} signInMethods={signInMethods} canCreateOrganization={canCreate} key={`${active?.id ?? "none"}:${section}`} section={section} integrationError={parseGitHubError(error)} integrationConnected={connected === "1"} organizations={organizations} activeOrganization={active} members={members} summary={summary} github={github} user={{ id: session.user.id, name: session.user.name, email: session.user.email }} />;
}

async function OnboardingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const session = await requireSession();
  const organizations = (await getAuth().api.listOrganizations({ headers: await headers() })).map(({ id, name, slug, logo }) => ({ id, name, slug, logo }));
  const active = organizations.find((org) => org.id === session.session.activeOrganizationId);
  if (!active) redirect("/dashboard?view=repositories");
  const github = await workspaceStatus(active.id, session.user.id, getAuth());
  if (!github.canManage) redirect("/dashboard?view=repositories");
  const error = (await searchParams).error;
  const canCreate = await canCreateOrganization(session.user);
  return <Dashboard canCreateOrganization={canCreate} key={active.id} section="repositories" organizations={organizations} activeOrganization={active} members={[]} user={{ id: session.user.id, name: session.user.name, email: session.user.email }} github={github} onboarding onboardingError={parseGitHubError(error) ?? false} />;
}

async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const organizations = await getAuth().api.listOrganizations({ headers: await headers() });
  const active = organizations.find((organization) => organization.id === session.session.activeOrganizationId);
  const github = active ? await workspaceStatus(active.id, session.user.id, getAuth()) : undefined;
  const saved = active && additionalChatRepositories ? await additionalChatRepositories(active.id, session.user.id) : [];
  const connected = github?.repositories ?? [];
  const scopeKey = JSON.stringify([session.user.id, active?.id]);
  const collapsed = (await cookies()).get(sidebarCookie)?.value === "1";

  // Keep the same chat instance, messages, focus and scroll across workspace pages.
  // A user/workspace change still gets a separate instance and access checks.
  return <SidebarProvider initialCollapsed={collapsed}>{children}{active && <WorkspaceChat key={scopeKey} scopeKey={scopeKey}
    panelId={`workspace-chat-${active.id}`} organizationId={active.id} organizationName={active.name}
    repositories={[...connected, ...saved.filter(r => !connected.some(c => c.id === r.id))]} />}</SidebarProvider>;
}

return { DashboardPage, OnboardingPage, WorkspaceLayout };
}
