"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import styles from "./settings.module.css";
import shared from "./dashboard.module.css";
import { useDashboardEdition } from "./dashboard-edition";
import { useNotifications } from "./notification-toast";

export function AutomaticReviewSettings({ organizationId }: { organizationId: string }) {
  const edition = useDashboardEdition();
  const { notify, clearToast } = useNotifications();
  const [settings, setSettings] = useState<{ automatic: boolean; auto_fix: boolean; ignored_authors: string[]; check_threshold: string; can_manage: boolean } | null>(null);
  const [authors, setAuthors] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const endpoint = `/api/review-settings?${new URLSearchParams({ organizationId })}`;
  const load = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await productFetch(endpoint, { signal, cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not load automatic review settings.");
      if (!signal?.aborted) { setSettings(data); setAuthors((data.ignored_authors ?? []).join("\n")); setLoadFailed(false); }
    } catch (error) {
      if (!signal?.aborted) {
        setLoadFailed(true);
        notify("error", error instanceof Error ? error.message : "Could not load automatic review settings.");
      }
    }
  }, [endpoint, notify]);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => load(controller.signal));
    return () => controller.abort();
  }, [load]);
  async function change(field: "automatic" | "auto_fix" | "ignored_authors" | "check_threshold", value: boolean | string[] | string) {
    if (pending.current || !settings?.can_manage) return;
    pending.current = true; setBusy(true); clearToast();
    try {
      const response = await productFetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ [field]: value }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save automatic review settings.");
      setSettings(data); notify("success", "Settings saved.");
      if (field === "ignored_authors") setAuthors(data.ignored_authors.join("\n"));
    } catch (error) { notify("error", error instanceof Error ? error.message : "Could not save automatic review settings."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <section className={styles.section} aria-labelledby="automatic-review-heading" aria-busy={busy}>
    <header className={styles.sectionHeader}><div><h2 id="automatic-review-heading">Automatic reviews</h2><p>Keep pull requests reviewed as your code changes.</p></div></header>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><label htmlFor="automatic-reviews">Review pull requests automatically</label><p>Review new pull requests and pushes, post findings on the relevant lines, and keep the first comment updated with the latest report. Reply “fixed” or “review again” for a follow-up.</p></div>
      <div className={styles.field}>
        <label className={styles.automaticToggle}><input id="automatic-reviews" type="checkbox" role="switch" checked={settings?.automatic ?? true} disabled={!settings?.can_manage || busy} onChange={event => void change("automatic", event.target.checked)} />{settings ? settings.automatic ? "On" : "Off" : loadFailed ? "Unavailable" : "Loading…"}</label>
        <p className={styles.hint}>{edition.automaticReviewNote}</p>
        {settings && !settings.can_manage && <p className={styles.hint}>Only workspace owners and admins can change this.</p>}
      </div>
    </div>
    <div className={styles.row}>
      <div className={styles.fieldDescription}>
        <label htmlFor="check-threshold">GitHub check failure threshold</label>
        <p id="check-threshold-help">New PR checks fail when a finding reaches this severity or higher.</p>
      </div>
      <div className={styles.field}>
        <select id="check-threshold" className={styles.input} aria-describedby="check-threshold-help"
          value={settings?.check_threshold ?? "P0"} disabled={!settings?.can_manage || busy}
          onChange={event => void change("check_threshold", event.target.value)}>
          <option value="P0">P0 · Critical only</option>
          <option value="P1">P1 · High and critical</option>
          <option value="P2">P2 · Medium and above</option>
          <option value="P3">P3 · All findings</option>
        </select>
      </div>
    </div>
    <div className={styles.row}>
      <div className={styles.fieldDescription}><label htmlFor="auto-fix">Auto fix</label><p>Automatically fix findings after a review and commit the changes to the same PR. If automatic reviews are on, the new commit is reviewed again.</p></div>
      <div className={styles.field}>
        <label className={styles.automaticToggle}><input id="auto-fix" type="checkbox" role="switch" checked={settings?.auto_fix ?? false} disabled={!settings?.can_manage || busy} onChange={event => void change("auto_fix", event.target.checked)} />{settings ? settings.auto_fix ? "On" : "Off" : loadFailed ? "Unavailable" : "Loading…"}</label>
        <p className={styles.hint}>{edition.automaticFixNote}</p>
      </div>
    </div>
    <form className={styles.row} onSubmit={event => { event.preventDefault(); void change("ignored_authors", authors.split(/[\n,]/).map(value => value.trim()).filter(Boolean)); }}>
      <div className={styles.fieldDescription}><label htmlFor="ignored-pr-authors">Ignored PR authors</label><p>Skip automatic reviews, GitHub replies and automatic fixes for PRs opened by these accounts across this workspace. You can still start reviews manually in Inkspect.</p></div>
      <div className={styles.field}>
        <textarea id="ignored-pr-authors" className={`${styles.input} ${styles.authorList}`} rows={4} value={authors} placeholder={"dependabot[bot]\nrenovate[bot]"} disabled={!settings?.can_manage || busy} aria-describedby="ignored-pr-authors-hint" onChange={event => setAuthors(event.target.value)} />
        <p id="ignored-pr-authors-hint" className={styles.hint}>One GitHub username per line, or separated by commas. Use the full bot login, including [bot]. Names are not case-sensitive. Up to 100 accounts; leave empty to review all authors.</p>
        <div className={styles.authorActions}>
          <button className={shared.secondaryButton} type="button" disabled={!settings?.can_manage || busy} onClick={() => setAuthors(value => [...new Set([...value.split(/[\n,]/).map(entry => entry.trim()).filter(Boolean), "dependabot[bot]"])].join("\n"))}>Add Dependabot</button>
          <button className={shared.primaryButton} type="submit" disabled={!settings?.can_manage || busy}>{busy ? "Saving…" : "Save ignored authors"}</button>
        </div>
      </div>
    </form>
    {loadFailed && <button type="button" className={shared.secondaryButton} onClick={() => { clearToast(); void load(); }}>Retry loading automatic review settings</button>}
  </section>;
}
