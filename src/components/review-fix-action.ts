export type FixApproval = { head: string; paths: string[] };
type State = { available: boolean; pr_open?: boolean; pr_ready?: boolean; review_stale?: boolean; approval?: FixApproval; fix: { id: string; retryable?: boolean } | null };

export function fixAction(state: State | null, approved = false):
  { kind: 'blocked' } | { kind: 'approve' } | { kind: 'submit'; body: { retry_of?: string; approval?: FixApproval } } {
  if (!state?.available || state.pr_open !== true || state.pr_ready === false || state.review_stale === true || (state.fix && !state.fix.retryable)) return { kind: 'blocked' };
  if (state.approval && !approved) return { kind: 'approve' };
  return { kind: 'submit', body: {
    ...(state.fix?.retryable ? { retry_of: state.fix.id } : {}),
    ...(approved && state.approval ? { approval: state.approval } : {}),
  } };
}

// Progress receipts omit live PR fields; they must not re-enable a stale review.
export type LatestFixReview = { id: string; status: string };
export type ReviewBlocker = 'draft' | 'ignored_author' | 'automatic_disabled' | 'not_scheduled';
export function reviewBlockerMessage(blocker?: ReviewBlocker | null) {
  if (blocker === 'ignored_author') return 'This PR author is excluded in workspace settings. Automatic review will not start for the new commit.';
  if (blocker === 'automatic_disabled') return 'Automatic reviews are disabled in workspace settings. No review has started for the new commit.';
  if (blocker === 'draft') return 'This PR is a draft. Mark it ready for review to continue.';
  if (blocker === 'not_scheduled') return 'No review is scheduled for the current PR commit.';
  return undefined;
}
export function latestReviewAction(review?: LatestFixReview | null, blocker?: ReviewBlocker | null) {
  const ready = !!review && ["completed", "failed", "cancelled"].includes(review.status);
  return { ready, label: !review && blocker ? blocker === "ignored_author" ? "Review skipped" : blocker === "automatic_disabled" ? "Automatic reviews off" : blocker === "draft" ? "PR is a draft" : "Review not scheduled" : ready ? "View latest review" : !review ? "Waiting for review…" : review.status === "paused" ? "Review paused" : "Review in progress…" };
}

type Readiness = { pr_open?: boolean; pr_ready?: boolean; review_stale?: boolean; review_reason?: string; latest_review?: LatestFixReview | null; review_blocker?: ReviewBlocker | null };
export function retainFixReadiness<T extends { available: boolean }>(previous: ({ available: boolean } & Readiness) | null, result: T & Readiness): T & Readiness {
  return { ...result, pr_open: result.pr_open ?? previous?.pr_open,
    pr_ready: result.pr_ready ?? previous?.pr_ready, review_stale: result.review_stale ?? previous?.review_stale,
    review_blocker: result.pr_open === undefined ? previous?.review_blocker : result.review_blocker,
    latest_review: result.pr_open === undefined ? previous?.latest_review : result.latest_review,
    review_reason: result.pr_open === undefined ? previous?.review_reason : result.review_reason };
}
