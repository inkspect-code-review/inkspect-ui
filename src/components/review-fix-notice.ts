type Fix = { id: string; error: string | null };
export type FixNotice = { jobId: string; fix: Fix | null; error: string };

// A persisted failure is history on first load, not a new action result.
// Keep newly observed failures visible until dismissed/retried, without replaying
// them on polling. An explicit action may return a failure immediately.
export function observeFixNotice(previous: FixNotice | null, jobId: string, fix: Fix | null, requested = false): FixNotice {
  const sameReport = previous?.jobId === jobId;
  const newlyFailed = fix?.error && (requested || (sameReport && (previous.fix?.id !== fix.id || !previous.fix.error)));
  return { jobId, fix, error: newlyFailed ? fix.error! : sameReport && fix?.error ? previous.error : '' };
}
