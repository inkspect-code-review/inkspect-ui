"use client";

import { useEffect, useRef, useState } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import styles from "./settings.module.css";
import shared from "./dashboard.module.css";
import { useDashboardEdition } from "./dashboard-edition";

export function AutomaticReviewSettings({ organizationId }: { organizationId: string }) {
  const edition = useDashboardEdition();
  const [settings, setSettings] = useState<{ automatic: boolean; auto_fix: boolean; can_manage: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const pending = useRef(false);
  const endpoint = `/api/review-settings?${new URLSearchParams({ organizationId })}`;
  useEffect(() => {
    const controller = new AbortController();
    void productFetch(endpoint, { signal: controller.signal, cache: "no-store" }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load automatic review settings.");
      if (!controller.signal.aborted) { setSettings(data); setError(""); }
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Could not load automatic review settings."); });
    return () => controller.abort();
  }, [endpoint]);
  async function change(field: "automatic" | "auto_fix", value: boolean) {
    if (pending.current || !settings?.can_manage) return;
    pending.current = true; setBusy(true); setError(""); setSaved(false);
    try {
      const response = await productFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save automatic review settings.");
      setSettings(data); setSaved(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save automatic review settings."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.section} aria-labelledby="automatic-review-heading" aria-busy={busy}>
    <header className={styles.sectionHeader}><div><h2 id="automatic-review-heading">Automatic reviews</h2><p>Keep pull requests reviewed as your code changes.</p></div></header>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><label htmlFor="automatic-reviews">Review pull requests automatically</label><p>Review new pull requests and pushes, post findings on the relevant lines, and keep the first comment updated with the latest report. Reply “fixed” or “review again” for a follow-up.</p></div>
      <div className={styles.field}>
        <label className={styles.automaticToggle}><input id="automatic-reviews" type="checkbox" role="switch" checked={settings?.automatic ?? true} disabled={!settings?.can_manage || busy} onChange={event => void change("automatic", event.target.checked)} />{settings ? settings.automatic ? "On" : "Off" : "Loading…"}</label>
        <p className={styles.hint}>{edition.automaticReviewNote}</p>
        {settings && !settings.can_manage && <p className={styles.hint}>Only workspace owners and admins can change this.</p>}
        {saved && <p className={styles.saved} role="status">Settings saved.</p>}
        {error && <p className={shared.error} role="alert">{error}</p>}
      </div>
    </div>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><label htmlFor="auto-fix">Auto fix</label><p>Automatically fix findings after a review and commit the changes to the same PR. If automatic reviews are on, the new commit is reviewed again.</p></div>
      <div className={styles.field}>
        <label className={styles.automaticToggle}><input id="auto-fix" type="checkbox" role="switch" checked={settings?.auto_fix ?? false} disabled={!settings?.can_manage || busy} onChange={event => void change("auto_fix", event.target.checked)} />{settings ? settings.auto_fix ? "On" : "Off" : "Loading…"}</label>
        <p className={styles.hint}>{edition.automaticFixNote}</p>
      </div>
    </div>
  </section>;
}
