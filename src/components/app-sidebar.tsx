"use client";

import { useDashboardEdition, useDashboardWidgets } from "./dashboard-edition";
import Image from "next/image";
import Link from "next/link";
import { BookOpen, Check, ChevronDown, ChevronsUpDown, CircleHelp, LockKeyhole, MessageSquare, Plus, X } from "lucide-react";
import { type DashboardOrganization, type DashboardSection } from "@inkspect/core/lib/dashboard";
import { NavUser } from "./nav-user";
import { DashboardIcon } from "./dashboard-icon";
import { WorkspaceAvatar } from "./workspace-avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { Sidebar, useSidebar } from "./ui/sidebar";
import styles from "./app-sidebar.module.css";

type Props = {
  section: DashboardSection;
  homeHref: string;
  organizations: DashboardOrganization[];
  activeOrganization: DashboardOrganization | null;
  user: { id: string; name: string; email: string };
  busy: boolean;
  canCreateOrganization: boolean;
  onSelectOrganization: (id: string) => void;
  onCreateOrganization: () => void;
  onSignOut: () => void;
  onOpenFeedback?: () => void;
  onOpenAbout?: () => void;
};

export function AppSidebar({ section, homeHref, organizations, activeOrganization, user, busy, canCreateOrganization, onSelectOrganization, onCreateOrganization, onSignOut, onOpenFeedback, onOpenAbout }: Props) {
  const edition = useDashboardEdition();
  const { navigationIcons } = useDashboardWidgets();
  const { navigation, sections: dashboardSections } = edition;
  const { open, isMobile, setOpenMobile } = useSidebar();
  const hasSupport = edition.sections.some(item => item.id === "support");
  const compact = !isMobile && !open;
  const closeMobile = () => setOpenMobile(false);

  return <Sidebar collapsible="icon" className={styles.sidebar} aria-label="Workspace navigation">
    <div className={styles.inner} data-compact={compact}>
      <div className={styles.brandRow}>
        <Link href={homeHref} onClick={closeMobile} className={styles.brand} aria-label="Inkspect home">
          <Image src="/brand/inkspect-symbol-white.svg" alt="" width={23} height={29} priority />
          <span>inkspect</span>
        </Link>
        {isMobile && <button className={styles.close} onClick={closeMobile} aria-label="Close navigation"><X size={18} /></button>}
      </div>
      <div className={styles.organization}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={styles.switcher} aria-label={`Switch workspace: ${activeOrganization?.name ?? "Your workspace"}`} title={compact ? activeOrganization?.name ?? "Your workspace" : undefined} disabled={busy}>
              <WorkspaceAvatar organization={activeOrganization} className={styles.orgAvatar} />
              <span className={styles.orgName}>{activeOrganization?.name ?? "Your workspace"}</span>
              <ChevronDown size={14} className={styles.switcherArrow} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className={styles.workspaceMenu} align="start" side={compact ? "right" : "bottom"} sideOffset={8} collisionPadding={12}>
            <DropdownMenuLabel className={styles.menuLabel}>Your workspaces</DropdownMenuLabel>
            {organizations.map((organization) => <DropdownMenuItem className={styles.workspaceOption} key={organization.id} disabled={busy}
              textValue={organization.name} title={organization.name} aria-current={activeOrganization?.id === organization.id ? "true" : undefined}
              onSelect={() => { if (activeOrganization?.id !== organization.id) onSelectOrganization(organization.id); }}>
              <WorkspaceAvatar organization={organization} className={styles.orgAvatar} />
              <span className={styles.optionName}>{organization.name}</span>
              {activeOrganization?.id === organization.id && <Check className={styles.selectedIcon} aria-hidden="true" />}
            </DropdownMenuItem>)}
            {!organizations.length && <p className={styles.emptyWorkspaces}>No workspaces yet</p>}
            <DropdownMenuSeparator className={styles.menuSeparator} />
            <DropdownMenuItem className={styles.createOrganization} disabled={busy} onSelect={() => { closeMobile(); onCreateOrganization(); }}>
              <span className={styles.createIcon} aria-hidden="true"><Plus /></span>
              <span className={styles.optionName}>Create organization</span>
              {!canCreateOrganization && <><LockKeyhole className={styles.lockIcon} aria-hidden="true" /><span className="sr-only">{edition.organizationRestriction.label}</span></>}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <nav className={styles.navigation} aria-label="Workspace pages">
        {navigation.map((group) => <div className={styles.group} key={group.title}>
          <p className={styles.groupTitle}>{group.title}</p>
          <ul>{group.sections.map((id) => {
            const item = dashboardSections.find((entry) => entry.id === id)!;
            return <li key={id}><Link className={styles.navLink} href={id === "dashboard" ? homeHref : `/dashboard?view=${id}`} aria-label={item.name} title={compact ? item.name : undefined} aria-current={section === id ? "page" : undefined} onClick={closeMobile}>
              {navigationIcons?.[id] ?? <DashboardIcon name={id} />}<span>{item.name}</span>
            </Link></li>;
          })}</ul>
        </div>)}
      </nav>
      <div className={styles.footer}>
        {isMobile ? <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={`${styles.navLink} ${styles.navButton}`} aria-label="Help" data-active={section === "support"}>
              <CircleHelp size={18} /><span>Help</span><ChevronsUpDown className={styles.helpArrow} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-64 rounded-lg" side="top" align="end" sideOffset={12} collisionPadding={12}>
            {onOpenFeedback && <DropdownMenuItem id="workspace-feedback-trigger" className="min-h-11" onSelect={() => { closeMobile(); onOpenFeedback(); }}><MessageSquare />Feedback</DropdownMenuItem>}
            {hasSupport && <DropdownMenuItem className="min-h-11" asChild><Link href="/dashboard?view=support" aria-current={section === "support" ? "page" : undefined} onClick={closeMobile}><DashboardIcon name="support" />Support</Link></DropdownMenuItem>}
            <DropdownMenuItem className="min-h-11" asChild><a href="https://inkspect.si/docs" target="_blank" rel="noopener noreferrer" onClick={closeMobile}><BookOpen />Documentation</a></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu> : <>
        {onOpenFeedback && <button id="workspace-feedback-trigger" type="button" className={`${styles.navLink} ${styles.navButton}`} aria-label="Feedback" aria-haspopup="dialog" title={compact ? "Feedback" : undefined} onClick={() => { closeMobile(); onOpenFeedback(); }}><MessageSquare size={18} /><span>Feedback</span></button>}
        {hasSupport && <Link className={styles.navLink} href="/dashboard?view=support" aria-label="Support" title={compact ? "Support" : undefined} aria-current={section === "support" ? "page" : undefined} onClick={closeMobile}><DashboardIcon name="support" /><span>Support</span></Link>}
        <a className={styles.navLink} href="https://inkspect.si/docs" target="_blank" rel="noopener noreferrer" aria-label="Documentation" title={compact ? "Documentation" : undefined}><BookOpen size={18} /><span>Documentation</span></a>
        </>}
        {!onOpenAbout && <p className={styles.version} title="UI version">UI {process.env.NEXT_PUBLIC_UI_VERSION === "dev" ? "dev" : `v${process.env.NEXT_PUBLIC_UI_VERSION}`}</p>}
        <div className={styles.account}><NavUser user={user} busy={busy} onSignOut={onSignOut} onNavigate={closeMobile} onOpenAbout={onOpenAbout} /></div>
      </div>
    </div>
  </Sidebar>;
}
