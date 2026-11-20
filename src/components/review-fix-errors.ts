export type FixErrors = { jobId: string; action: string; progress: string; revision: number };
type Event = { jobId: string; type: 'action-start' | 'action-error' | 'progress-error' | 'progress-ok'; message?: string };

export function reduceFixErrors(previous: FixErrors, event: Event): FixErrors {
  const state = previous.jobId === event.jobId ? previous : { jobId: event.jobId, action: '', progress: '', revision: previous.revision };
  switch (event.type) {
    case 'action-start': return { ...state, action: '', progress: '' };
    case 'action-error': return { ...state, action: event.message || 'The fix could not start.', revision: state.revision + 1 };
    case 'progress-error': return { ...state, progress: event.message || 'Fix progress is temporarily unavailable.' };
    case 'progress-ok': return { ...state, progress: '' };
  }
}
