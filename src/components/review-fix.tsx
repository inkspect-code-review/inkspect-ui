"use client";

import { Notification } from "./notification-toast";

import { useEffect, useRef, useState } from "react";
import { GitCommitHorizontal, ArrowUpRight, LoaderCircle, Check } from "lucide-react";
import styles from "./reviews.module.css";
import { useDashboardEdition } from "./dashboard-edition";

type Fix = { id: string; status: string; commit: string | null; error: string | null };
type State = { available: boolean; pr_open?: boolean; billing_mode?: "byok" | "cloud"; reason?: string; fix: Fix | null };
type Request = (action: string, extra?: Record<string, string>, body?: object, signal?: AbortSignal) => Promise<State>;
const ongoing = (fix?: Fix | null) => !!fix && ["queued", "running", "paused"].includes(fix.status);

export function ReviewFix({ jobId, pullUrl, request }: { jobId: string; pullUrl: string; request: Request }) {
  const edition = useDashboardEdition();
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const alive = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let checkedPull = false;
    const refresh = async () => {
      try {
        // One live PR check on entering Findings; progress polling stays offline.
        const result = await request("fix", { jobId, ...(!checkedPull ? { checkPull: "1" } : {}) }, undefined, controller.signal);
        if (controller.signal.aborted) return;
        if (!checkedPull && typeof result.pr_open !== "boolean") throw new Error("Could not check whether this PR is still open.");
        checkedPull = true;
        setState(previous => ({ ...result, pr_open: result.pr_open ?? previous?.pr_open })); setError("");
        if (result.pr_open === false) return;
        // Automatic fixes can be admitted after the report first becomes visible.
        if (ongoing(result.fix)) timer = setTimeout(refresh, 3000);
        else if (result.available && !result.fix) timer = setTimeout(refresh, 15000);
      } catch (failure) {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : "Fix progress is temporarily unavailable.");
        timer = setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => { alive.current = false; controller.abort(); clearTimeout(timer); };
  }, [jobId, request, revision]);
  const start = async () => {
    if (sending.current || state?.pr_open !== true || !state.available || state.fix) return;
    sending.current = true; setPending(true); setError("");
    try {
      const result = await request("fix", { jobId }, {});
      if (alive.current) { setState(previous => ({ ...result, pr_open: result.pr_open ?? previous?.pr_open })); setRevision(v => v + 1); }
    } catch (failure) {
      if (alive.current) {
        setError(failure instanceof Error ? failure.message : "The fix could not start.");
        // A lost response is not a failed admission. Fetch the durable receipt
        // before enabling another click; the server also deduplicates it.
        try { const result = await request("fix", { jobId }); if (alive.current) { setState(previous => ({ ...result, pr_open: result.pr_open ?? previous?.pr_open })); setRevision(v => v + 1); } } catch { /* Keep the actionable error. */ }
      }
    } finally { sending.current = false; if (alive.current) setPending(false); }
  };
  const fix = state?.fix;
  const closed = state?.pr_open === false;
  const unverified = state?.pr_open === undefined;
  const checking = unverified && !error;
  const active = !closed && (pending || ongoing(fix));
  const completed = !!fix?.commit;
  const status = pending ? "Starting fix…" : fix?.status === "queued" ? "Fix queued" : fix?.status === "paused" ? edition.fix.pausedStatus : "Fixing findings…";
  const label = checking ? "Checking PR status…" : unverified ? "PR status unavailable" : closed ? "Fix with Inkspect AI" : active ? status : fix ? "Fix stopped" : "Fix with Inkspect AI";
  const note = closed ? "Auto fix is unavailable because this PR is closed." : checking ? "Checking the PR on GitHub." : unverified ? "Could not verify PR status. Retrying…" : active ? "You can leave this page." : completed ? fix.commit?.slice(0, 7) : "One commit. Same PR.";
  return <aside className={styles.aiFix} aria-label="Fix with Inkspect AI" aria-busy={checking || active}>
    <div className={styles.aiFixMark} aria-hidden="true"><GitCommitHorizontal size={24} strokeWidth={1.5} /></div>
    <div className={styles.aiFixCopy}>
      <h3>{completed ? "Fix committed to your PR" : "From findings to fixes."}</h3>
      <p>{completed ? "Your PR has a new commit. If automatic reviews are enabled, a new review will follow." : "Let Inkspect AI fix these findings and commit to this PR. Automatic reviews pick up the new changes when enabled."}</p>
      <small>{completed ? "Generated changes need verification. Tests were not run by the fix engine." : (state?.billing_mode === "byok" ? edition.fix.byokDescription : edition.fix.managedDescription)}</small>
      {fix?.status === "paused" && !closed && <p role="status">{edition.fix.pausedMessage}</p>}
      <Notification tone={error || fix?.error ? "error" : "info"} message={error || fix?.error || state?.reason} />
    </div>
    <div className={styles.aiFixAction}>
      {completed && !closed && !unverified ? <a href={`${pullUrl}/commits/${fix.commit}`} target="_blank" rel="noreferrer"><Check size={15} />View commit<ArrowUpRight size={14} /></a>
        : <button type="button" className={styles.primary} onClick={start} disabled={unverified || closed || !state?.available || pending || !!fix} aria-busy={checking || active}>
          <span key={label} className={styles.aiFixButtonContent}>
            {(checking || active) && <LoaderCircle size={15} className={styles.aiFixSpinner} aria-hidden="true" />}
            {label}
          </span>
        </button>}
      <span aria-live="polite">{note}</span>
    </div>
  </aside>;
}
