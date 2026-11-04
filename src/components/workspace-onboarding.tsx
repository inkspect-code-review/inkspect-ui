import { DashboardIcon } from "./dashboard-icon";
import styles from "./dashboard.module.css";
import { githubErrorMessage, type GitHubConnectionError } from "@inkspect/core/lib/github-errors";

export function WorkspaceOnboarding({ name, configured, error, connectedAccount }: { name: string; configured: boolean; error: boolean | GitHubConnectionError; connectedAccount?: string }) {
  return <section className={`${styles.panel} ${styles.onboardingPanel}`}>
    <div className={styles.panelHeader}><span>{connectedAccount ? "Manage GitHub connection" : "Set up your workspace"}</span><span className={styles.muted}>{connectedAccount ? `Connected to ${connectedAccount}` : "1 of 3 complete"}</span></div>
    <div className={styles.onboardingIntro}><h2>{connectedAccount ? "Make room for your next repository." : "Bring your code into the conversation."}</h2><p>{connectedAccount ? "Update repository access on GitHub, then authorize the connection again to refresh your list." : "Your workspace is ready. Connect GitHub to bring your repositories and your team’s reviews together."}</p></div>
    <ol className={styles.setupSteps}>
      <li data-complete="true"><span className={styles.stepNumber}><DashboardIcon name="check" /></span><div><h3>Your workspace is ready</h3><p>{name}</p></div><span className={styles.stepStatus}>Done</span></li>
      <li><span className={styles.stepNumber}>02</span><div><h3>{connectedAccount ? "Open your GitHub App installation" : "Install the GitHub App"}</h3><p>Choose your personal account or a GitHub organization.</p></div></li>
      <li><span className={styles.stepNumber}>03</span><div><h3>Choose your repositories</h3><p>Select the repositories on GitHub, then authorize the connection to return here.</p></div></li>
    </ol>
    <div className={styles.setupActions}>
      {error && <p className={styles.error} role="alert">{githubErrorMessage(error === true ? "connect" : error)}</p>}
      {!configured && <p className={styles.muted}>GitHub connection isn’t available yet. You can continue and connect your repositories later.</p>}
      <div className={styles.setupActionButtons}>
        <form action="/api/github/start" method="post"><button className={styles.primaryButton} disabled={!configured}><DashboardIcon name="repositories" />{connectedAccount ? "Update repository access" : "Connect GitHub"}<DashboardIcon name="arrow" /></button></form>
        <form action="/api/onboarding/skip" method="post"><button className={styles.skipButton}>{connectedAccount ? "Back to workspace" : "I’ll do this later"}</button></form>
      </div>
    </div>
    <div className={styles.panelFooter}>You choose which repositories Inkspect can access.</div>
  </section>;
}
