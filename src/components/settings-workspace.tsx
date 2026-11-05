"use client";

import { useState, useTransition, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Building2, Cpu, Palette, UserRound, type LucideIcon } from "lucide-react";
import { Tabs } from "radix-ui";
import { authClient } from "@inkspect/core/lib/auth-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import type { DashboardOrganization } from "@inkspect/core/lib/dashboard";
import type { SignInMethod } from "@inkspect/core/lib/login-providers";
import { AccountSecurity } from "./account-security";
import { ByokSettings } from "./byok-settings";
import { AutomaticReviewSettings } from "./automatic-review-settings";
import { useNotifications } from "./notification-toast";
import { SignInMethods } from "./sign-in-methods";
import { ThemePicker } from "./theme-picker";
import { WorkspaceLogo } from "./workspace-logo";
import shared from "./dashboard.module.css";
import styles from "./settings.module.css";

type SettingsWorkspaceProps = {
  organization: DashboardOrganization;
  canManage: boolean;
  user: { name: string; email: string };
  signInMethods?: SignInMethod[];
  logoUploadsEnabled: boolean;
};

export function SettingsWorkspace(props: SettingsWorkspaceProps) {
  return <WorkspaceSettings {...props} />;
}

function WorkspaceSettings({ organization, canManage, user, signInMethods, logoUploadsEnabled }: SettingsWorkspaceProps) {
  const router = useRouter();
  const { notify, clearToast } = useNotifications();
  const [name, setName] = useState(organization.name);
  const [saving, setSaving] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const [invalidName, setInvalidName] = useState(false);
  const busy = saving || refreshing;

  async function renameWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !canManage) return;
    const trimmed = name.trim();
    clearToast();
    setInvalidName(false);
    if (trimmed.length < 2 || trimmed.length > 80) {
      setInvalidName(true);
      notify("error", "Enter a workspace name between 2 and 80 characters.");
      return;
    }
    if (trimmed === organization.name) return;
    setSaving(true);
    try {
      const result = await authClient.organization.update({ organizationId: organization.id, data: { name: trimmed } });
      if (result.error) {
        reportBrowserError("browser.dashboard.shell", result.error);
        notify("error", "Couldn’t update the workspace name. Check that you’re still an owner or admin and try again.");
        return;
      }
      setName(trimmed);
      notify("success", "Workspace name updated.");
      startTransition(() => router.refresh());
    } catch (diagnosticError) {
      reportBrowserError("browser.dashboard.shell", diagnosticError);
      notify("error", "Couldn’t connect. Check your connection and try again.");
    } finally { setSaving(false); }
  }

  return <SettingsTabs user={user} signInMethods={signInMethods} workspace={<>
        <section className={styles.section} aria-labelledby="workspace-settings-heading">
          <header className={styles.sectionHeader}>
            <div><h2 id="workspace-settings-heading">Workspace</h2><p>The shared home for your repositories and reviews.</p></div>
          </header>
          <form onSubmit={renameWorkspace} aria-busy={busy} noValidate>
            <WorkspaceLogo organization={organization} canManage={canManage} uploadsEnabled={logoUploadsEnabled} />
            <div className={styles.row}>
              <div className={styles.fieldDescription}>{canManage ? <label htmlFor="workspace-name">Workspace name</label> : <h3>Workspace name</h3>}<p>How your workspace appears in Inkspect.</p></div>
              <div className={styles.field}>
                {canManage ? <input className={styles.input} id="workspace-name" name="workspaceName" autoComplete="organization" required minLength={2} maxLength={80} value={name} disabled={busy} aria-invalid={invalidName} onChange={event => { setName(event.target.value); setInvalidName(false); }} /> : <p className={styles.value}>{organization.name}</p>}
                {!canManage && <p className={styles.hint}>Only workspace owners and admins can change this.</p>}
              </div>
            </div>
            <div className={styles.row}>
              <div className={styles.fieldDescription}><h3>Workspace slug</h3><p>Your workspace’s unique identifier.</p></div>
              <div className={styles.readOnlyValue}><span>{organization.slug}</span><span className={styles.readOnlyLabel}>Read only</span></div>
            </div>
            {canManage && <div className={styles.formFooter}>
              <p className={styles.hint}>Changes apply to everyone in this workspace.</p>
              <button type="submit" className={shared.primaryButton} disabled={busy || name.trim() === organization.name}>{saving ? "Saving…" : "Save changes"}</button>
            </div>}
          </form>
        </section>
        <AutomaticReviewSettings key={organization.id} organizationId={organization.id} />
  </>} reviewProvider={<ByokSettings organizationId={organization.id} />} />;
}

type AccountSettingsProps = {
  user: { name: string; email: string };
  signInMethods?: SignInMethod[];
};

function AccountSettings({ user, signInMethods }: AccountSettingsProps) {
  return <div className={styles.accountCards}><section className={`${styles.section} ${styles.accountCard}`} aria-labelledby="account-settings-heading">
    <header className={styles.sectionHeader}>
      <div><h2 id="account-settings-heading">Your account</h2><p>Your identity and sign-in methods across all workspaces.</p></div>
    </header>
    <div className={styles.profile}>
      <span className={styles.avatar} aria-hidden="true">{(user.name || user.email).slice(0, 2).toUpperCase()}</span>
      <div><strong>{user.name || "Your account"}</strong><span>{user.email}</span></div>
    </div>
    {signInMethods && <SignInMethods methods={signInMethods} email={user.email} />}
  </section>
  <section className={`${styles.section} ${styles.accountCard}`} aria-labelledby="security-settings-heading">
    <header className={styles.sectionHeader}><div><h2 id="security-settings-heading">Security</h2><p>Protect your account with two-factor authentication and passkeys.</p></div></header>
    <AccountSecurity />
  </section></div>;
}

// The label stays the accessible name (it is the only visible text on narrow screens); the summary is its description.
function SettingsTab({ value, label, description, icon: Icon }: { value: string; label: string; description: string; icon: LucideIcon }) {
  const descriptionId = `settings-tab-${value}-description`;
  return <Tabs.Trigger className={styles.tab} value={value} aria-label={label} aria-describedby={descriptionId} title={label}>
    <Icon aria-hidden="true" size={16} />
    <span className={styles.tabText}><span className={styles.tabLabel}>{label}</span><span className={styles.tabDescription} id={descriptionId}>{description}</span></span>
  </Tabs.Trigger>;
}

function SettingsTabs({ workspace, reviewProvider, user, signInMethods }: AccountSettingsProps & { workspace?: ReactNode; reviewProvider?: ReactNode }) {
  return <Tabs.Root className={styles.layout} orientation="vertical" defaultValue={workspace ? "workspace" : "account"}>
    <Tabs.List className={styles.tabList} aria-label="Settings sections">
      {workspace && <SettingsTab value="workspace" icon={Building2} label="Workspace" description="Name, logo, and review automation" />}
      {reviewProvider && <SettingsTab value="review-provider" icon={Cpu} label="Review provider" description="Inkspect AI or your own API key" />}
      <SettingsTab value="account" icon={UserRound} label="Your account" description="Profile, sign-in, and security" />
      <SettingsTab value="appearance" icon={Palette} label="Appearance" description="Theme for this browser" />
    </Tabs.List>
    {workspace && <Tabs.Content className={styles.tabPanel} value="workspace" forceMount>{workspace}</Tabs.Content>}
    {reviewProvider && <Tabs.Content className={styles.tabPanel} value="review-provider" forceMount>{reviewProvider}</Tabs.Content>}
    <Tabs.Content className={`${styles.tabPanel} ${styles.accountPanel}`} value="account" forceMount><AccountSettings user={user} signInMethods={signInMethods} /></Tabs.Content>
    <Tabs.Content className={styles.tabPanel} value="appearance" forceMount><ThemePicker /></Tabs.Content>
  </Tabs.Root>;
}

export function PersonalSettings(props: AccountSettingsProps) {
  return <div className={styles.personalSheet}><SettingsTabs {...props} /></div>;
}
