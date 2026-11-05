"use client";

import { Notification } from "./notification-toast";

import { useState } from "react";
import Link from "next/link";
import { productAPIURL } from "@inkspect/core/lib/api-client";
import type { WorkspaceStatus } from "@inkspect/core/lib/workspace-status";
import { githubErrorMessage, type GitHubConnectionError } from "@inkspect/core/lib/github-errors";
import { DashboardIcon, type DashboardIconName } from "./dashboard-icon";
import { ProviderIcon } from "./provider-icon";
import shared from "./dashboard.module.css";
import styles from "./integrations.module.css";

type IntegrationProps = {
  organizationId: string;
  github: WorkspaceStatus;
  error?: GitHubConnectionError;
  connected: boolean;
  returnTo?: "integrations" | "reviews";
};

const providerGroups = [
  { id: "code", name: "Source code" },
  { id: "planning", name: "Project management" },
  { id: "docs", name: "Documentation" },
] as const;

const providers = [
  { id: "github", name: "GitHub", description: "Accounts & organizations", group: "code" },
  { id: "gitlab", name: "GitLab", description: "Groups & projects", group: "code" },
  { id: "bitbucket", name: "Bitbucket", description: "Workspaces & repositories", group: "code" },
  { id: "linear", name: "Linear", description: "Teams & issues", group: "planning" },
  { id: "jira", name: "Jira", description: "Projects & issues", group: "planning" },
  { id: "notion", name: "Notion", description: "Pages & documentation", group: "docs" },
] as const;
type IntegrationProvider = (typeof providers)[number]["id"];
type UpcomingProvider = Exclude<IntegrationProvider, "github">;

const upcomingDetails = {
  gitlab: {
    description: "Bring your groups and projects into Inkspect.",
    title: "Your GitLab repositories, in one place",
    body: "Connect a group, choose your projects, and manage access from here once the integration is available.",
    access: "You’ll choose which projects Inkspect can access.",
    icon: "repositories",
  },
  bitbucket: {
    description: "Bring your workspace repositories into Inkspect.",
    title: "Your Bitbucket repositories, in one place",
    body: "Connect a workspace, choose your repositories, and manage access from here once the integration is available.",
    access: "You’ll choose which repositories Inkspect can access.",
    icon: "repositories",
  },
  linear: {
    description: "Bring issue context into your code reviews.",
    title: "Connect your code to the work behind it",
    body: "Link your Linear workspace to bring issue descriptions and project context into Inkspect once the integration is available.",
    access: "You’ll manage Linear access from this workspace.",
    icon: "clipboard",
  },
  jira: {
    description: "Keep project requirements close to your code.",
    title: "Give your reviews the full issue context",
    body: "Link your Jira projects to bring issue details and requirements into Inkspect once the integration is available.",
    access: "You’ll manage Jira access from this workspace.",
    icon: "clipboard",
  },
  notion: {
    description: "Bring your team’s documentation into Inkspect.",
    title: "Connect the knowledge behind your code",
    body: "Link your Notion pages to bring specifications, decisions, and team documentation into Inkspect once the integration is available.",
    access: "You’ll manage Notion access from this workspace.",
    icon: "documentation",
  },
} satisfies Record<UpcomingProvider, { description: string; title: string; body: string; access: string; icon: DashboardIconName }>;

export function IntegrationsPanel(props: IntegrationProps) {
  const [selected, setSelected] = useState<IntegrationProvider>("github");
  const [expandedGroup, setExpandedGroup] = useState<(typeof providerGroups)[number]["id"] | null>("code");
  const hasGitHub = props.github.connections.length > 0;

  return <div className={styles.layout}>
    <div className={styles.directory}>
      <div className={styles.directoryHeading}><h2>All integrations</h2><span>{providers.length}</span></div>
      <div className={styles.providerList}>
        {providerGroups.map((group) => <div key={group.id} className={styles.providerGroup}>
          <h3><button
            type="button"
            id={`integration-group-${group.id}`}
            className={styles.groupToggle}
            aria-expanded={expandedGroup === group.id}
            aria-controls={`integration-options-${group.id}`}
            onClick={() => setExpandedGroup(expandedGroup === group.id ? null : group.id)}
          >{group.name}<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></button></h3>
          <div id={`integration-options-${group.id}`} className={styles.groupOptions} role="group" aria-labelledby={`integration-group-${group.id}`} hidden={expandedGroup !== group.id}>
        {providers.filter((provider) => provider.group === group.id).map((provider) => <button
          key={provider.id}
          type="button"
          className={styles.providerOption}
          aria-pressed={selected === provider.id}
          aria-controls="integration-details"
          onClick={() => setSelected(provider.id)}
        >
          <span className={styles.providerMark}><ProviderIcon provider={provider.id} width={23} height={23} /></span>
          <span className={styles.providerLabel}>
            <strong>{provider.name}</strong>
            <span>{provider.description}</span>
            <span className={provider.id === "github" && hasGitHub ? styles.listConnected : styles.providerStatus}>
              {provider.id === "github" ? (hasGitHub ? "Connected" : "Not connected") : "Coming soon"}
            </span>
          </span>
          <DashboardIcon name="arrow" className={styles.selectionArrow} />
        </button>)}
          </div>
        </div>)}
      </div>
    </div>
    <div id="integration-details" className={styles.detail}>
      {selected === "github" ? <GitHubIntegration {...props} /> : <UpcomingIntegration provider={selected} />}
    </div>
  </div>;
}

function UpcomingIntegration({ provider }: { provider: UpcomingProvider }) {
  const name = providers.find((item) => item.id === provider)!.name;
  const details = upcomingDetails[provider];
  return <section className={`${shared.panel} ${styles.panel}`} aria-labelledby={`${provider}-integration-title`}>
    <div className={styles.header}>
      <span className={`${styles.provider} ${styles.upcomingProvider}`}><ProviderIcon provider={provider} width={28} height={28} /></span>
      <div className={styles.heading}><h2 id={`${provider}-integration-title`}>{name}</h2><p>{details.description}</p></div>
      <span className={styles.soonBadge}>Coming soon</span>
    </div>
    <div className={styles.previewEmpty}>
      <div className={styles.connectionArtwork} aria-hidden="true"><ProviderIcon provider={provider} width={32} height={32} /><span /><DashboardIcon name={details.icon} /></div>
      <h3>{details.title}</h3>
      <p>{details.body}</p>
      <button type="button" className={shared.primaryButton} disabled aria-describedby={`${provider}-availability`}>Connect {name}</button>
      <span id={`${provider}-availability`} className={styles.availability}>Connections aren’t available yet.</span>
    </div>
    <div className={styles.previewFooter}><DashboardIcon name="lock" /><p>{details.access}</p></div>
  </section>;
}

function GitHubIntegration({ organizationId, github, error, connected, returnTo = "integrations" }: IntegrationProps) {
  const { connections, repositories, canManage, configured } = github;
  return <>
    <section className={`${shared.panel} ${styles.panel}`} aria-labelledby="github-integration-title">
    <div className={styles.header}>
      <span className={styles.provider}><ProviderIcon provider="github" width={28} height={28} /></span>
      <div className={styles.heading}><h2 id="github-integration-title">GitHub</h2><p>Choose which repositories Inkspect can review.</p></div>
      {canManage && <form action="/api/github/start" method="post">
        <input type="hidden" name="returnTo" value={returnTo} />
        <input type="hidden" name="organizationId" value={organizationId} />
        <button className={shared.primaryButton} disabled={!configured}><DashboardIcon name="plus" />{connections.length ? "Add account or organization" : "Connect GitHub"}</button>
      </form>}
    </div>
    <Notification tone="error" message={error ? githubErrorMessage(error) : ""} />
    <Notification tone="success" message={!error && connected ? "GitHub connection saved. Your repository list is up to date." : ""} />
    <Notification tone="error" message={!configured ? "GitHub connections are currently unavailable. Try again later." : ""} />
    {!canManage && <p className={styles.message}>A workspace owner or admin can add accounts and update repository access.</p>}
    {connections.length ? <>
      <div className={styles.summary}><span>{connections.length} connected {connections.length === 1 ? "account" : "accounts"}</span><Link href="/dashboard?view=repositories">{repositories.length} {repositories.length === 1 ? "repository" : "repositories"}<DashboardIcon name="arrow" /></Link></div>
      <ul className={styles.connections}>{connections.map((connection) => <li key={connection.id}>
        <div className={styles.accountRow}>
          <span className={styles.avatar} aria-hidden="true">{connection.accountLogin.slice(0, 1).toUpperCase()}</span>
          <div className={styles.account}><h3>{connection.accountLogin}</h3><p>{connection.repositories.length} {connection.repositories.length === 1 ? "repository" : "repositories"}<span>Synced {new Date(connection.updatedAt).toISOString().slice(0, 10)}</span></p></div>
          <span className={styles.connected}><span />Connected</span>
        </div>
        <div className={styles.accountDetails}>
          <details><summary>View repositories</summary><ul className={styles.repositories}>{connection.repositories.map((repo) => <li key={repo.id}><DashboardIcon name="repositories" /><span>{repo.fullName}</span><span className={shared.roleBadge}>{repo.private ? "Private" : "Public"}</span></li>)}</ul></details>
          {canManage && <div className={styles.actions}>
            <a className={shared.secondaryButton} href={productAPIURL(`/api/review-settings?${new URLSearchParams({ view: "github-access", organizationId, installationId: connection.installationId })}`)} target="_blank" rel="noopener noreferrer" aria-label={`Manage ${connection.accountLogin} access on GitHub`}>Manage access<span aria-hidden="true">↗</span></a>
            <form action="/api/github/start" method="post">
              <input type="hidden" name="returnTo" value={returnTo} />
              <input type="hidden" name="organizationId" value={organizationId} />
              <input type="hidden" name="connectionId" value={connection.id} />
              <button className={shared.secondaryButton} disabled={!configured} aria-label={`Refresh ${connection.accountLogin} repositories`}>Refresh repositories</button>
            </form>
          </div>}
        </div>
      </li>)}</ul>
    </> : <div className={styles.empty}><DashboardIcon name="integrations" /><h3>Connect your code</h3><p>Connect a personal account or organization and choose which repositories Inkspect can access.</p></div>}
    <details className={styles.guide}>
      <summary><DashboardIcon name="lock" />Connection help &amp; repository access</summary>
      <div className={styles.guideBody}>
      <h2>You control the access</h2>
      <p>Choose the repositories to share when you install the GitHub app. You can change that selection at any time.</p>
      <div className={styles.guideSection}><h3>Adding an organization?</h3><p>Choose it on GitHub using your current account. You’ll need permission to install apps in that organization.</p></div>
      <div className={styles.guideSection}><h3>Changed your repositories?</h3><p>Use Manage access to update your selection and save it on GitHub. Your repository list updates automatically when you return to Inkspect.</p></div>
      <details className={styles.troubleshooting}><summary>Can’t find an organization?</summary><p>If GitHub opens an existing installation instead of the organization picker, ask the app owner to check whether the app allows installation on other accounts.</p></details>
      <Link className={styles.helpLink} href="/dashboard?view=support">Get help connecting GitHub</Link>
      </div>
    </details>
    </section>
  </>;
}
