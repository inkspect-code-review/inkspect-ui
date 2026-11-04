import Link from "next/link";
import { linkConfirmationPath, type SignInMethod } from "@inkspect/core/lib/login-providers";
import { ProviderIcon } from "./provider-icon";
import { DashboardIcon } from "./dashboard-icon";
import shared from "./dashboard.module.css";
import styles from "./sign-in-methods.module.css";

export function SignInMethods({ methods, email }: { methods: SignInMethod[]; email: string }) {
  return <section className={styles.section} aria-labelledby="sign-in-methods-heading">
    <h3 id="sign-in-methods-heading" className={styles.heading}>Sign-in methods</h3>
    <div>
      <p className={styles.description}>Connected providers let you sign in to your <strong>{email}</strong> account.</p>
      <ul className={styles.methods}>
        {methods.map(method => <li key={method.id} className={styles.method}>
          <span className={styles.icon}><ProviderIcon provider={method.id} /></span>
          <div className={styles.identity}>
            <span className={styles.name}>{method.name}</span>
            <span className={styles.detail}>{!method.available ? "Sign-in is currently unavailable" : method.connected ? "Ready to use for sign-in" : "Add another way to sign in"}</span>
          </div>
          {method.connected ? <span className={styles.connected}><DashboardIcon name="check" />Connected</span> : method.available ?
            <Link className={shared.secondaryButton} href={linkConfirmationPath(method.id, "settings")} aria-label={`Connect ${method.name}`}>Connect</Link> :
            <span className={styles.unavailable}>Unavailable</span>}
        </li>)}
      </ul>
      <p className={styles.note}>Choose a provider account with the same email. You may be asked to sign in again to confirm it’s you.</p>
    </div>
  </section>;
}
