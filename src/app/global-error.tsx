"use client";

import { ErrorState, type ErrorStateProps } from "../components/error-state";

export default function GlobalError(props: ErrorStateProps) {
  return <html lang="en"><body style={{ margin: 0 }}><title>Unable to load · Inkspect</title><ErrorState {...props} /></body></html>;
}
