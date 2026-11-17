export type FixApproval = { head: string; paths: string[] };
type State = { available: boolean; pr_open?: boolean; approval?: FixApproval; fix: { id: string; retryable?: boolean } | null };

export function fixAction(state: State | null, approved = false):
  { kind: 'blocked' } | { kind: 'approve' } | { kind: 'submit'; body: { retry_of?: string; approval?: FixApproval } } {
  if (!state?.available || state.pr_open !== true || (state.fix && !state.fix.retryable)) return { kind: 'blocked' };
  if (state.approval && !approved) return { kind: 'approve' };
  return { kind: 'submit', body: {
    ...(state.fix?.retryable ? { retry_of: state.fix.id } : {}),
    ...(approved && state.approval ? { approval: state.approval } : {}),
  } };
}
