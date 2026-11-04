import Image from "next/image";
import Link from "next/link";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./dashboard.module.css";

export function RepositoryConnectionCard({ section, workspaceName, canManage }: { section: "repositories" | "findings"; workspaceName: string; canManage: boolean }) {
  const isFindings = section === "findings";
  return <section className={styles.panel}>
    <div className={styles.panelHeader}><span>{isFindings ? "Findings" : "Repositories"}</span><span className={styles.muted}>{workspaceName}</span></div>
    <div className={styles.emptyState}>
      <div className={styles.emptyArtwork}><DashboardIcon name={section} /></div>
      <h2>{isFindings ? "Connect your code to see findings." : "Your code belongs here."}</h2>
      <p>{isFindings ? "No repositories connected yet. Connect GitHub and complete a review to see findings here." : "No repositories connected yet. Connected repositories and their review settings will appear here."}</p>
      {canManage ? <Link className={styles.primaryButton} href="/dashboard?view=integrations">Connect GitHub<DashboardIcon name="arrow" /></Link> : <p>Ask a workspace owner or admin to connect GitHub.</p>}
    </div>
    <div className={styles.panelFooter}><Image src="/brand/inkspect-symbol-white.svg" alt="" width={14} height={18} /><span>Read between the lines.</span></div>
  </section>;
}
