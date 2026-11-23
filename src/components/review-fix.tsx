"use client";

import { fixAction, retainFixReadiness, latestReviewAction, type LatestFixReview, type ReviewBlocker, reviewBlockerMessage } from "./review-fix-action";
import { observeFixNotice, type FixNotice } from "./review-fix-notice";
import { reduceFixErrors } from "./review-fix-errors";
import { ConfirmationDialog } from "./confirmation-dialog";
import { Notification } from "./notification-toast";

import { useEffect, useReducer, useRef, useState } from "react";
import { GitCommitHorizontal, ArrowUpRight, LoaderCircle, Check } from "lucide-react";
import styles from "./reviews.module.css";
import { useDashboardEdition } from "./dashboard-edition";

type Fix = { id: string; status: string; commit: string | null; error: string | null; retryable?: boolean };
type State = { available: boolean; pr_open?: boolean; pr_ready?: boolean; review_stale?: boolean; review_reason?: string; latest_review?: LatestFixReview | null; review_blocker?: ReviewBlocker | null; billing_mode?: "byok" | "cloud"; reason?: string; approval?: { head: string; paths: string[] }; fix: Fix | null };
type Request = (action: string, extra?: Record<string, string>, body?: object, signal?: AbortSignal) => Promise<State>;
const ongoing = (fix?: Fix | null) => !!fix && ["queued", "running", "paused"].includes(fix.status);

export function ReviewFix({ jobId, pullUrl, request, openFindingCount, onReviewLatest }: { jobId: string; pullUrl: string; request: Request; openFindingCount: number; onReviewLatest: (jobId: string) => void }) {
  const edition = useDashboardEdition();
  const [state, setState] = useState<State | null>(null);
  const [errors, updateErrors] = useReducer(reduceFixErrors, { jobId, action: '', progress: '', revision: 0 });
  const error = errors.jobId === jobId ? errors.action || errors.progress : '';
  const [notice, setNotice] = useState<FixNotice | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const actionRef = useRef<HTMLButtonElement>(null);
  const [pending, setPending] = useState(false);
  const sending = useRef(false);
  const alive = useRef(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let checkedPull = false;
    let awaitingReview = false;
    const refresh = async () => {
      try {
        // Recheck while waiting for the current PR revision to receive a review.
        // Ordinary fix progress polling stays offline.
        const result = await request("fix", { jobId, ...(!checkedPull || awaitingReview ? { checkPull: "1" } : {}) }, undefined, controller.signal);
        if (controller.signal.aborted) return;
        if ((!checkedPull || awaitingReview) && typeof result.pr_open !== "boolean") throw new Error("Could not check whether this PR is still open.");
        checkedPull = true;
        awaitingReview = !!result.review_stale && !latestReviewAction(result.latest_review).ready;
        setNotice(previous => observeFixNotice(previous, jobId, result.fix));
        setState(previous => retainFixReadiness(previous, result)); updateErrors({ jobId, type: 'progress-ok' });
        if (result.pr_open === false) return;
        // Automatic fixes can be admitted after the report first becomes visible.
        if (awaitingReview) timer = setTimeout(refresh, 15000);
        else if (ongoing(result.fix)) timer = setTimeout(refresh, 3000);
        else if (result.available && !result.fix) timer = setTimeout(refresh, 15000);
      } catch (failure) {
        if (controller.signal.aborted) return;
        updateErrors({ jobId, type: 'progress-error', message: failure instanceof Error ? failure.message : undefined });
        timer = setTimeout(refresh, 10000);
      }
    };
    void refresh();
    return () => { alive.current = false; controller.abort(); clearTimeout(timer); };
  }, [jobId, request, revision]);
  const start = async (approved = false) => {
    if (!openFindingCount) return;
    const action = fixAction(state, approved);
    if (sending.current || action.kind === "blocked") return;
    if (action.kind === "approve") { setApprovalOpen(true); return; }
    setApprovalOpen(false);
    sending.current = true; setPending(true); updateErrors({ jobId, type: 'action-start' });
    setNotice(previous => previous ? { ...previous, error: "" } : previous);
    try {
      const result = await request("fix", { jobId }, action.body);
      if (alive.current) { setNotice(previous => observeFixNotice(previous, jobId, result.fix, !result.approval)); setState(previous => retainFixReadiness(previous, result)); if (result.approval) setApprovalOpen(true); else setRevision(v => v + 1); }
    } catch (failure) {
      if (alive.current) {
        updateErrors({ jobId, type: 'action-error', message: failure instanceof Error ? failure.message : undefined });
        // A lost response is not a failed admission. Fetch the durable receipt
        // before enabling another click; the server also deduplicates it.
        try { const result = await request("fix", { jobId }); if (alive.current) { setState(previous => retainFixReadiness(previous, result)); setRevision(v => v + 1); } } catch { /* Keep the actionable error. */ }
      }
    } finally { sending.current = false; if (alive.current) setPending(false); }
  };
  const fix = state?.fix;
  const fixError = notice?.jobId === jobId ? notice.error : "";
  const closed = state?.pr_open === false;
  const unverified = state?.pr_open === undefined;
  const checking = unverified && !error;
  const active = !closed && (pending || ongoing(fix));
  const completed = !!fix?.commit;
  const latest = latestReviewAction(state?.latest_review, state?.review_blocker);
  const blockedMessage = !state?.latest_review ? reviewBlockerMessage(state?.review_blocker) : undefined;
  const stale = !!state?.review_stale && !active && !completed;
  const status = pending ? "Starting fix…" : fix?.status === "queued" ? "Fix queued" : fix?.status === "paused" ? edition.fix.pausedStatus : "Fixing findings…";
  const label = checking ? "Checking PR status…" : unverified ? "PR status unavailable" : active ? status : state?.approval ? "Review file permissions" : fix?.retryable ? "Retry Auto Fix" : fix ? "Fix stopped" : "Auto Fix";
  const note = stale ? blockedMessage ? "No review is running for the new commit." : latest.ready ? "Continue on the latest PR version." : "This updates automatically." : closed ? "Auto fix is unavailable because this PR is closed." : checking ? "Checking the PR on GitHub." : unverified ? "Could not verify PR status. Retrying…" : active ? "You can leave this page." : completed ? fix.commit?.slice(0, 7) : "One commit. Same PR.";
  const notification = <Notification tone={error || fixError ? "error" : "info"} message={error || fixError || state?.reason} notificationKey={errors.jobId === jobId && errors.action ? `action-${errors.revision}` : fixError ? notice?.fix?.id : undefined} />;
  if (closed || (!openFindingCount && !active && !completed && !stale) || (state && !state.available && !fix && !unverified && !stale && !state.review_reason)) return error ? notification : null;
  return <aside className={styles.aiFix} aria-label="Fix with Inkspect AI" aria-busy={checking || active}>
    <div className={styles.aiFixMark} aria-hidden="true"><GitCommitHorizontal size={24} strokeWidth={1.5} /></div>
    <div className={styles.aiFixCopy}>
      <h3>{completed ? "Fix committed to your PR" : stale ? "This review is out of date" : active ? status : `${openFindingCount} open ${openFindingCount === 1 ? "finding" : "findings"}`}</h3>
      <p>{completed ? "Review the commit and verify the changes." : stale || state?.pr_ready === false ? blockedMessage || state?.review_reason : "Let Inkspect AI fix the findings in this PR."}</p>
      <small>{completed ? "Generated changes need verification. Tests were not run by the fix engine." : (state?.billing_mode === "byok" ? edition.fix.byokDescription : edition.fix.managedDescription)}</small>
      {fix?.status === "paused" && !closed && <p role="status">{edition.fix.pausedMessage}</p>}
      {notification}
    </div>
    <div className={styles.aiFixAction}>
      {stale ? <button type="button" className={styles.primary} disabled={!latest.ready} onClick={() => { if (state?.latest_review && latest.ready) onReviewLatest(state.latest_review.id); }}><span className={styles.aiFixButtonContent}>{!latest.ready && !blockedMessage && state?.latest_review?.status !== "paused" && <LoaderCircle size={15} className={styles.aiFixSpinner} aria-hidden="true" />}{latest.label}</span></button> : completed && !closed && !unverified ? <a href={`${pullUrl}/commits/${fix.commit}`} target="_blank" rel="noreferrer"><Check size={15} />View commit<ArrowUpRight size={14} /></a>
        : <button ref={actionRef} type="button" className={styles.primary} onClick={() => void start()} disabled={!openFindingCount || unverified || closed || !state?.available || state.pr_ready === false || state.review_stale === true || pending || (!!fix && !fix.retryable)} aria-busy={checking || active}>
          <span key={label} className={styles.aiFixButtonContent}>
            {(checking || active) && <LoaderCircle size={15} className={styles.aiFixSpinner} aria-hidden="true" />}
            {label}
          </span>
        </button>}
      <span aria-live="polite">{note}</span>
    </div>
    <ConfirmationDialog open={approvalOpen && !!state?.approval} onOpenChange={setApprovalOpen} restoreFocusRef={actionRef}
      title="Allow these file changes?" confirmLabel="Approve for me" busy={pending} onConfirm={() => void start(true)}
      description={<><span>Auto-fix needs permission to edit the paths below. Approval applies only to this fix on the reviewed version of your PR. The changes must still pass verification before a commit is sent.</span>
        {state?.approval?.paths.map(path => <code key={path} style={{ display: "block", overflowWrap: "anywhere", marginTop: 8 }}>{path}</code>)}
        <span style={{ display: "block", marginTop: 12 }}>Approving starts the fix{fix?.retryable ? " again" : ""} using your selected provider or credits.</span></>} />
  </aside>;
}
