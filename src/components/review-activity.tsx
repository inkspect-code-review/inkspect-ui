"use client";
import { Notification } from "./notification-toast";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import { useEffect, useRef, useState } from "react";
import { activityLabel, mergeActivity, type ReviewActivityEvent } from "@inkspect/core/lib/review-activity";
import styles from "./reviews.module.css";

type RequestActivity = (action: string, extra?: Record<string, string>, body?: object, signal?: AbortSignal) => Promise<{ events: ReviewActivityEvent[]; next_cursor: number; has_more: boolean }>;
export function ReviewActivity({ jobId, revision, running, request }: { jobId: string; revision: number; running: boolean; request: RequestActivity }) {
  const [rows, setRows] = useState<ReviewActivityEvent[]>([]), [error, setError] = useState("");
  const [follow, setFollow] = useState(true), [milestones, setMilestones] = useState(false);
  const refresh = useRef<(() => void) | null>(null), viewport = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    let cursor = 0, busy = false, queued = false;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      if (controller.signal.aborted) return;
      if (busy) { queued = true; return; }
      busy = true; clearTimeout(timer);
      try {
        for (let page = 0; page < 21; page++) {
          const result = await request("activity", { jobId, after: String(cursor) }, undefined, controller.signal);
          if (controller.signal.aborted) return;
          if (!Array.isArray(result.events) || !Number.isSafeInteger(result.next_cursor) || result.next_cursor < cursor) throw new Error("Invalid activity response.");
          setRows((current) => mergeActivity(current, result.events)); setError("");
          const moved = result.next_cursor > cursor; cursor = result.next_cursor;
          if (!result.has_more || !moved) break;
        }
      } catch (error) { reportBrowserError("browser.review.activity", error); if (!controller.signal.aborted) setError((error as Error).message); }
      finally {
        busy = false;
        if (!controller.signal.aborted) { const delay = queued ? 1000 : running ? 10_000 : 30_000; queued = false; timer = setTimeout(load, delay); }
      }
    };
    refresh.current = () => { void load(); };
    void load();
    return () => { refresh.current = null; controller.abort(); clearTimeout(timer); };
  }, [jobId, request, running]);
  useEffect(() => { refresh.current?.(); }, [revision]);
  useEffect(() => { if (follow && viewport.current) viewport.current.scrollTop = viewport.current.scrollHeight; }, [rows, follow, milestones]);
  const visible = milestones ? rows.filter((row) => !row.event.kind.startsWith("source.operation.")) : rows;
  return <section className={styles.activity} aria-label="Review activity">
    <header className={styles.activityHeader}><div><span className={styles.activityDot} data-running={running} /><h3>Activity</h3><span>{running ? "In progress" : "History"}</span></div><div><button aria-pressed={milestones} onClick={() => setMilestones((v) => !v)}>{milestones ? "Milestones" : "All events"}</button><button aria-pressed={follow} onClick={() => setFollow((v) => !v)}>Follow live</button></div></header>
    <Notification tone="error" message={error} action={{ label: "Reconnect to review activity", onClick: () => refresh.current?.() }} />
    <div className={styles.activityScroll} ref={viewport} onScroll={() => { const box = viewport.current; if (box && box.scrollHeight - box.scrollTop - box.clientHeight > 60 && follow) setFollow(false); }}>
      {!visible.length && <p className={styles.activityEmpty}>{running ? "Waiting for activity from the worker…" : "No activity was recorded for this review."}</p>}
      <ol>{visible.map((row) => <li key={row.sequence} data-failed={row.event.kind.endsWith(".failed")}><time dateTime={row.created_at}>{new Date(row.created_at).toLocaleTimeString([], { hour12: false })}</time><div><span>{activityLabel(row)}</span>{row.event.path && <code title={row.event.path}>{row.event.path}</code>}{row.event.code && <small>{row.event.code}</small>}{row.event.input_tokens !== undefined && <small>Input {row.event.input_tokens.toLocaleString()} · output {(row.event.output_tokens || 0).toLocaleString()} · cached {row.event.cached_input_tokens === undefined ? "unknown" : row.event.cached_input_tokens.toLocaleString()}</small>}</div><small>{row.event.duration_ms !== undefined ? `${(row.event.duration_ms / 1000).toFixed(1)}s` : row.event.output_tokens !== undefined ? `${row.event.output_tokens.toLocaleString()} tokens` : ""}</small></li>)}</ol>
    </div>
    <footer className={styles.activityFooter}><span>{rows.length} recorded events</span><span>{follow ? "Following latest activity" : "Scroll paused"}</span></footer>
  </section>;
}
