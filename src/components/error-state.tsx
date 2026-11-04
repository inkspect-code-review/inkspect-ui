"use client";

import { useEffect } from "react";
import { CircleAlert, RotateCcw } from "lucide-react";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import styles from "./error-state.module.css";

export type ErrorStateProps = { error: unknown; retry: () => void };

export function ErrorState({ error, retry }: ErrorStateProps) {
  useEffect(() => { reportBrowserError("browser.react", error); }, [error]);
  return <main id="main" className={styles.page}>
    <header className={styles.header}><a href="/dashboard" className={styles.brand}>Inkspect</a><span>Workspace</span></header>
    <div className={styles.content}>
      <section className={styles.message} aria-labelledby="page-error-title">
        <span className={styles.icon}><CircleAlert size={24} aria-hidden="true" /></span>
        <h1 id="page-error-title">This page couldn’t load.</h1>
        <p>Try loading it again, or return to your dashboard to continue.</p>
        <div className={styles.actions}>
          <button type="button" onClick={retry}><RotateCcw size={16} aria-hidden="true" />Try again</button>
          <a href="/dashboard">Back to dashboard</a>
        </div>
      </section>
    </div>
  </main>;
}
