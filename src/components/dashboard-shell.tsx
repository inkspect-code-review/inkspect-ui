"use client";

import { Notification, useNotificationMessage } from "./notification-toast";
import { useDashboardEdition } from "./dashboard-edition";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type FormEvent, type ReactNode, type ComponentType } from "react";
import { authClient } from "@inkspect/core/lib/auth-client";
import { workspaceHomeHref, type DashboardSummary, type DashboardMember, type DashboardOrganization, type DashboardSection } from "@inkspect/core/lib/dashboard";
import { PersonalSettings as DefaultPersonalSettings, SettingsWorkspace as DefaultSettingsWorkspace } from "./settings-workspace";
import { DashboardIcon } from "./dashboard-icon";
import { GitHubPermissionBanner } from "./github-permission-banner";
import styles from "./dashboard.module.css";
import { WorkspaceChatLauncher } from "./workspace-chat";
import { AppSidebar } from "./app-sidebar";
import { SidebarInset, SidebarTrigger, useSidebar } from "./ui/sidebar";
import { Separator } from "./ui/separator";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "./ui/breadcrumb";
import { DashboardOverview, type InitialReviewOverview } from "./dashboard-overview";

import { RepositoriesWorkspace } from "./repositories-workspace";
import { ReviewWorkspace } from "./review-workspace";
import { FindingsPanel } from "./findings-panel";
import { RepositoryConnectionCard } from "./repository-connection-card";
import { KnowledgeCenter } from "./knowledge-center";
import type { SignInMethod } from "@inkspect/core/lib/login-providers";
import { CommandMenu } from "./command-menu";

import { IntegrationsPanel } from "./integrations-panel";
import { WorkspaceOnboarding } from "./workspace-onboarding";
import type { WorkspaceStatus } from "@inkspect/core/lib/workspace-status";
import type { GitHubConnectionError } from "@inkspect/core/lib/github-errors";
import { announceGitHubConnectionChange, subscribeGitHubConnectionChanges } from "@inkspect/core/lib/github-connection-sync";

export type DashboardExtensionProps = {
  organizationId: string; members: DashboardMember[]; organization: DashboardOrganization;
  user: DashboardShellProps["user"]; repositories: NonNullable<WorkspaceStatus>["repositories"];
  supportContext: DashboardShellProps["supportContext"]; turnstileSiteKey?: string;
};
export type DashboardPanels = {
  SettingsWorkspace?: typeof DefaultSettingsWorkspace;
  PersonalSettings?: typeof DefaultPersonalSettings;
  AboutDialog?: ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void }>;
  FeedbackDialog?: ComponentType<{ open: boolean; onOpenChange: (open: boolean) => void; organization: DashboardOrganization | null; pageName: string }>;
  UsagePanel: ComponentType<{ organizationId: string; members: DashboardMember[] }>;
  MembersPanel: ComponentType<{ organizationId: string; members: DashboardMember[]; canManage: boolean }>;
  extensions?: Partial<Record<DashboardSection, ComponentType<DashboardExtensionProps>>>;
};

export type DashboardShellProps = {
  section: DashboardSection;
  canCreateOrganization: boolean;
  turnstileSiteKey?: string;
  supportContext?: { reason: "general" | "repository-size" | "open-source"; repositoryId?: string };
  summary?: DashboardSummary;
  initialReviewOverview?: InitialReviewOverview;
  github?: WorkspaceStatus;
  integrationError?: GitHubConnectionError;
  integrationConnected?: boolean;
  signInMethods?: SignInMethod[];
  logoUploadsEnabled?: boolean;
  onboarding?: boolean;
  onboardingError?: boolean | GitHubConnectionError;
  organizations: DashboardOrganization[];
  activeOrganization: DashboardOrganization | null;
  members: DashboardMember[];
  user: { id: string; name: string; email: string };
};

export function DashboardShell({ headerAnnouncement, panels: { MembersPanel, UsagePanel, FeedbackDialog, AboutDialog, extensions, SettingsWorkspace = DefaultSettingsWorkspace, PersonalSettings = DefaultPersonalSettings }, canCreateOrganization, section, supportContext, turnstileSiteKey, organizations, activeOrganization, members, user, github, summary, initialReviewOverview, onboarding = false, onboardingError = false, integrationError, integrationConnected = false, signInMethods, logoUploadsEnabled = false }: DashboardShellProps & { panels: DashboardPanels; headerAnnouncement?: ReactNode }) {
  const edition = useDashboardEdition();
  const ExtensionPanel = extensions?.[section];
  const workspaceMain = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = workspaceMain.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      element.style.setProperty("--workspace-content-height", `${entry.contentRect.height}px`);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const router = useRouter();
  const { open, isMobile, openMobile } = useSidebar();
  const chatScopeKey = JSON.stringify([user.id, activeOrganization?.id]);
  const chatPanelId = `workspace-chat-${activeOrganization?.id ?? "none"}`;
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [refreshing, startTransition] = useTransition();
  const [error, setError, errorNotificationKey] = useNotificationMessage("");
  const [createError, setCreateError, createErrorNotificationKey] = useNotificationMessage("");
  const [organizationRestricted, setOrganizationRestricted] = useState(!canCreateOrganization);
  const [name, setName] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const busy = !!pending || refreshing;
  const current = edition.sections.find((item) => item.id === section) ?? edition.sections[0];
  const homeHref = workspaceHomeHref(github);
  const isSettingsWorkspace = section === "settings" && !onboarding && !!activeOrganization;
  const isRepositoryWorkspace = section === "repositories" && !onboarding && !!activeOrganization && !!github?.connections.length;
  const needsReviewConnection = section === "reviews" && !!github && github.connections.length === 0;
  // Workspaces with a docked secondary navigation use the full content width.
  const isSplitWorkspace = isRepositoryWorkspace || (["support", "reviews"].includes(section) && !needsReviewConnection && !onboarding && !!activeOrganization);

  const refresh = () => startTransition(() => router.refresh());

  const organizationId = activeOrganization?.id;
  const connectionRevision = JSON.stringify(github?.connections.map(connection => [connection.id, connection.updatedAt]).sort() ?? []);
  useEffect(() => {
    if (!organizationId) return;
    return subscribeGitHubConnectionChanges({ userId: user.id, organizationId }, () => startTransition(() => router.refresh()));
  }, [organizationId, user.id, router]);
  useEffect(() => {
    if (!organizationId || !integrationConnected) return;
    announceGitHubConnectionChange({ userId: user.id, organizationId }, connectionRevision);
  }, [organizationId, user.id, integrationConnected, connectionRevision]);

  function openCreate() {
    setOrganizationRestricted(!canCreateOrganization);
    setCreateError("");
    setName("");
    dialogRef.current?.showModal();
  }

  async function selectOrganization(id: string) {
    if (busy) return;
    setPending(id);
    setError("");
    try {
      const result = await authClient.organization.setActive({ organizationId: id });
      if (result.error) { reportBrowserError("browser.dashboard.shell", result.error); setError("Couldn’t switch organization. Please try again."); return; }
      refresh();
    } catch (diagnosticError) { reportBrowserError("browser.dashboard.shell", diagnosticError);
      setError("Couldn’t connect. Check your connection and try again.");
    } finally { setPending(null); }
  }

  async function createOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (organizationRestricted) return;
    const trimmed = name.trim();
    if (trimmed.length < 2) { setCreateError("Enter a name with at least 2 characters."); return; }
    setPending("create");
    setCreateError("");
    const prefix = trimmed.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "organization";
    try {
      const result = await authClient.organization.create({
        name: trimmed, slug: `${prefix}-${crypto.randomUUID().slice(0, 8)}`, keepCurrentActiveOrganization: false,
      });
      if (result.error) {
        if (result.error.code === "YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION") {
          setOrganizationRestricted(true);
          refresh();
          return;
        }
        reportBrowserError("browser.dashboard.shell", result.error);
        setCreateError("Couldn’t create the organization. Please try again.");
        return;
      }
      dialogRef.current?.close();
      refresh();
    } catch (diagnosticError) { reportBrowserError("browser.dashboard.shell", diagnosticError);
      setCreateError("Couldn’t connect. Check your connection and try again.");
    } finally { setPending(null); }
  }

  async function signOut() {
    if (busy) return;
    setPending("logout");
    setError("");
    try {
      const result = await authClient.signOut();
      if (result.error) { reportBrowserError("browser.dashboard.shell", result.error); setError("Couldn’t sign out. Please try again."); return; }
      router.replace("/login");
      router.refresh();
    } catch (diagnosticError) { reportBrowserError("browser.dashboard.shell", diagnosticError); setError("Couldn’t sign out. Please try again."); }
    finally { setPending(null); }
  }

  return <div className={styles.shell}>
    <AppSidebar section={section} homeHref={homeHref} organizations={organizations} activeOrganization={activeOrganization}
      user={user} busy={busy} canCreateOrganization={canCreateOrganization} onSelectOrganization={selectOrganization} onCreateOrganization={openCreate} onSignOut={signOut} onOpenFeedback={FeedbackDialog ? () => setFeedbackOpen(true) : undefined} onOpenAbout={AboutDialog ? () => setAboutOpen(true) : undefined} />
    <SidebarInset id="main" className={styles.contentContainer}>
      <header className={styles.containerHeader}>
        <SidebarTrigger aria-label={isMobile ? (openMobile ? "Close navigation" : "Open navigation") : (open ? "Collapse sidebar" : "Expand sidebar")} aria-expanded={isMobile ? openMobile : open} />
        <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
        <Breadcrumb className="min-w-0"><BreadcrumbList className="flex-nowrap">
          <BreadcrumbItem className="hidden min-w-0 sm:block"><span className="block max-w-48 truncate">{activeOrganization?.name ?? "Workspace"}</span></BreadcrumbItem>
          <BreadcrumbSeparator className="hidden sm:block" />
          <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="truncate">{onboarding ? "Getting started" : current.name}</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList></Breadcrumb>
        <div className={styles.headerActions}><CommandMenu section={section} homeHref={homeHref} />{activeOrganization && <div className={styles.headerChat}><WorkspaceChatLauncher scopeKey={chatScopeKey} panelId={chatPanelId} /></div>}</div>
      </header>
      {headerAnnouncement}
      {activeOrganization && !onboarding && <GitHubPermissionBanner key={activeOrganization.id} organizationId={activeOrganization.id} />}
      <div ref={workspaceMain} className={`${styles.main} ${onboarding && activeOrganization ? styles.onboardingMain : ""} ${isSplitWorkspace ? styles.repositoriesMain : ""} ${isSettingsWorkspace ? styles.settingsMain : ""}`} aria-busy={busy}>
        <div className={`${styles.pageContent} ${onboarding && activeOrganization ? styles.onboardingContent : ""} ${isSplitWorkspace ? styles.repositoriesContent : ""} ${isSettingsWorkspace ? styles.settingsContent : ""}`}>
        {!isSplitWorkspace && <div className={`${styles.pageHeading} ${current.compactHeading ? styles.compactHeading : ""}`}><div><h1>{onboarding ? "Make yourself at home." : current.name}</h1><p>{onboarding ? "A little setup. A new perspective on your code." : current.description}</p></div>{section === "reviews" && activeOrganization && <Link className={styles.secondaryButton} href="/dashboard?view=repositories"><DashboardIcon name="repositories" />Repositories</Link>}</div>}
        <Notification tone="error" message={error} notificationKey={errorNotificationKey} />
        {onboarding && activeOrganization ? <WorkspaceOnboarding name={activeOrganization.name} configured={!!github?.configured} error={onboardingError} connectedAccount={github?.connections.map((connection) => connection.accountLogin).join(", ")} /> : !activeOrganization ? <section className={styles.panel}>
          <div className={styles.panelHeader}><span>Getting started</span><span className={styles.muted}>Your organization</span></div>
          <div className={styles.emptyState}><div className={styles.emptyArtwork}><DashboardIcon name="organization" /><span /><DashboardIcon name="reviews" /></div><h2>{organizations.length ? "Choose your organization." : "Good reviews start with shared context."}</h2><p>{organizations.length ? "Select an organization to open its workspace." : "Create an organization to keep your repositories, reviews, and team in one place."}</p>
            {organizations.length ? <div className={styles.organizationChoices}>{organizations.map((org) => <button className={styles.secondaryButton} key={org.id} disabled={busy} onClick={() => selectOrganization(org.id)}>{org.name}<DashboardIcon name="arrow" /></button>)}</div> : <button className={styles.primaryButton} onClick={openCreate} disabled={busy}><DashboardIcon name="plus" />Create organization</button>}
          </div>
          <div className={styles.panelFooter}><Image src="/brand/inkspect-symbol-white.svg" alt="" width={14} height={18} /><span>A place for your code. A shared perspective for your team.</span></div>
        </section> : section === "dashboard" && summary ? <DashboardOverview initialOverview={initialReviewOverview} summary={summary} github={github} organizationId={activeOrganization.id} /> : section === "usage" ? <UsagePanel organizationId={activeOrganization.id} members={members} /> : ExtensionPanel ? <ExtensionPanel key={activeOrganization.id} organizationId={activeOrganization.id} members={members} organization={activeOrganization} user={user} repositories={github?.repositories ?? []} supportContext={supportContext} turnstileSiteKey={turnstileSiteKey} /> : needsReviewConnection && github ? <IntegrationsPanel organizationId={activeOrganization.id} github={github} error={integrationError} connected={integrationConnected} returnTo="reviews" /> : section === "findings" ? <FindingsPanel key={activeOrganization.id} organizationId={activeOrganization.id} workspaceName={activeOrganization.name} canManage={!!github?.canManage} connected={!!github?.connections.length} repositories={github?.repositories.map(repo => ({ id: repo.id, full_name: repo.fullName, private: repo.private })) ?? []} /> : section === "reviews" ? <ReviewWorkspace key={activeOrganization.id} organizationId={activeOrganization.id} initialRepositories={github?.repositories.map(repo => ({ id: repo.id, full_name: repo.fullName, private: repo.private }))} /> : section === "integrations" && github ? <IntegrationsPanel organizationId={activeOrganization.id} github={github} error={integrationError} connected={integrationConnected} /> : section === "repositories" && !!github?.connections.length ? <RepositoriesWorkspace key={activeOrganization.id} organizationId={activeOrganization.id} repositories={github.repositories} canManage={github.canManage} /> : section === "knowledge" ? <KnowledgeCenter key={activeOrganization.id} organizationId={activeOrganization.id} canManage={!!github?.canManage} /> : section === "members" ? <MembersPanel key={activeOrganization.id} organizationId={activeOrganization.id} members={members} canManage={!!github?.canManage} /> : section === "settings" ? <SettingsWorkspace logoUploadsEnabled={logoUploadsEnabled} key={activeOrganization.id} organization={activeOrganization} canManage={!!github?.canManage} user={user} signInMethods={signInMethods} /> : section === "repositories" ? <RepositoryConnectionCard section="repositories" workspaceName={activeOrganization.name} canManage={!!github?.canManage} /> : <section className={styles.panel}>
          <div className={styles.panelHeader}><span>{current.name}</span><span className={styles.muted}>{activeOrganization.name}</span></div>
          <div className={styles.emptyState}><div className={styles.emptyArtwork}><DashboardIcon name={section} /></div><h2>Give every review the full picture.</h2><p>No knowledge added yet. This is where your organization’s conventions, architecture, and review guidelines come together.</p></div>
          <div className={styles.panelFooter}><Image src="/brand/inkspect-symbol-white.svg" alt="" width={14} height={18} /><span>Read between the lines.</span></div>
        </section>}
        {section === "settings" && !onboarding && !activeOrganization && <PersonalSettings user={user} signInMethods={signInMethods} />}
        </div>
      </div>
    </SidebarInset>
    {AboutDialog && <AboutDialog open={aboutOpen} onOpenChange={setAboutOpen} />}
    {FeedbackDialog && <FeedbackDialog key={activeOrganization?.id ?? "no-workspace"} open={feedbackOpen} onOpenChange={setFeedbackOpen} organization={activeOrganization} pageName={current.name} />}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="create-org-title" onCancel={(event) => { if (pending === "create") event.preventDefault(); }}>
      <div className={styles.dialogHeader}><span className={styles.orgAvatar}><DashboardIcon name="organization" /></span><button className={styles.iconButton} onClick={() => dialogRef.current?.close()} disabled={pending === "create"} aria-label="Close"><DashboardIcon name="close" /></button></div>
      <h2 id="create-org-title">{organizationRestricted ? edition.organizationRestriction.title : "Create an organization"}</h2><p>{organizationRestricted ? edition.organizationRestriction.description : "One workspace for your code and the people who review it."}</p>
      {organizationRestricted ? (edition.organizationRestriction.action && <Link className={styles.primaryButton} href={edition.organizationRestriction.action.href} onClick={() => dialogRef.current?.close()}>{edition.organizationRestriction.action.label}<DashboardIcon name="arrow" /></Link>) : <>
      <form onSubmit={createOrganization}><label htmlFor="organization-name">Organization name</label><input id="organization-name" name="name" autoComplete="organization" autoFocus required minLength={2} maxLength={80} value={name} onChange={(event) => setName(event.target.value)} placeholder="Your team or company" disabled={pending === "create"} /><Notification tone="error" message={createError} notificationKey={createErrorNotificationKey} /><button type="submit" className={styles.primaryButton} disabled={busy}>{pending === "create" ? "Creating…" : "Create organization"}</button></form></>}
    </dialog>
  </div>;
}
