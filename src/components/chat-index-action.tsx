"use client";

import { Notification } from "./notification-toast";
import { useEffect, useRef, useState } from "react";
import type { ChatIndexAction as Action } from "@inkspect/core/lib/chat-actions";
import type { RepositoryIndex, RepositoryIndexEligibility } from "@inkspect/core/lib/repository-types";
import { productFetch } from "@inkspect/core/lib/api-client";
import { subscribeReviews } from "@inkspect/core/lib/review-realtime";
import { mergeRepositoryIndex } from "@inkspect/core/lib/repository-activity";
import styles from "./chat-index-action.module.css";

type Detail = { index: RepositoryIndex | null; eligibility: RepositoryIndexEligibility; realtime_channel?: string };
export function ChatIndexAction({ action, organizationId }: { action: Action; organizationId: string }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const posting = useRef(false);
  const requestId = useRef<string | null>(null);
  const lifetime = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const endpoint = (operation: string) => `/api/repositories?${new URLSearchParams({ organizationId, repository: String(action.repositoryId), action: operation })}`;
  async function read(response: Response): Promise<Detail> {
    const value = await response.json();
    if (!response.ok) throw new Error(value.error || "Could not confirm indexing. Retry to check its status.");
    return value;
  }
  useEffect(() => {
    const controller = new AbortController(); lifetime.current = controller;
    let fetching = false, needsRefresh = true, unsubscribe: (() => void) | undefined;
    async function refresh() {
      if (fetching || posting.current || controller.signal.aborted) return;
      fetching = true; const version = ++sequence.current;
      try {
        const value = await productFetch(`/api/repositories?${new URLSearchParams({ organizationId, repository: String(action.repositoryId), action: "detail" })}`, { signal: controller.signal, cache: "no-store" }).then(read);
        if (controller.signal.aborted || version !== sequence.current) return;
        setDetail(previous => ({ ...value, index: mergeRepositoryIndex(previous?.index ?? null, value.index) })); setError("");
        needsRefresh = !!value.index && ["queued", "running"].includes(value.index.status) || !value.eligibility.allowed && !value.eligibility.support_required;
        if (needsRefresh && !unsubscribe && value.realtime_channel) unsubscribe = subscribeReviews({ channel: value.realtime_channel, organizationId, onRefresh: () => void refresh(), onIndex: () => void refresh(), onState: () => {}, onMessage: () => {} });
        if (!needsRefresh && unsubscribe) { unsubscribe(); unsubscribe = undefined; }
      } catch (cause) { if (!controller.signal.aborted && version === sequence.current) setError(cause instanceof Error ? cause.message : "Could not check indexing."); }
      finally { fetching = false; }
    }
    void refresh();
    const timer = setInterval(() => { if (needsRefresh) void refresh(); }, 5000);
    return () => { controller.abort(); clearInterval(timer); unsubscribe?.(); };
  }, [organizationId, action.repositoryId, retry]);

  async function start() {
    if (posting.current || !detail?.eligibility.allowed) return;
    posting.current = true; ++sequence.current; setPending(true); setError("");
    requestId.current ??= crypto.randomUUID();
    const controller = lifetime.current;
    try {
      const value = await productFetch(endpoint("index"), { method: "POST", signal: controller?.signal, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current }) }).then(read);
      if (controller?.signal.aborted) return;
      setDetail(previous => ({ ...previous!, index: mergeRepositoryIndex(previous?.index ?? null, value.index) }));
      requestId.current = null;
      setRetry(value => value + 1);
    } catch (cause) { if (!controller?.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not start indexing."); }
    finally { posting.current = false; if (!controller?.signal.aborted) setPending(false); }
  }
  const active = detail?.index && ["queued", "running"].includes(detail.index.status);
  const ready = !active && detail?.index?.status === "completed" && detail.index.progress.indexed;
  const failed = detail?.index?.status === "failed";
  const status = !detail ? "Checking index…" : active ? detail.index?.status === "queued" ? "Queued for indexing" : "Indexing repository…" : ready ? "Ready — you can ask your question again." : failed ? "Indexing did not finish. You can retry." : "This repository needs an index. Index it now?";
  return <div className={styles.card}>
    <div className={styles.copy}><strong>{action.repository}</strong><span role="status">{status}</span></div>
    {!ready && !active && <button type="button" onClick={() => void start()} disabled={pending || !detail?.eligibility.allowed}>{pending ? "Starting…" : failed ? "Retry indexing" : "Yes, index now"}</button>}
    {detail && !detail.eligibility.allowed && !ready && !active && <p>{detail.eligibility.reason}</p>}
    <Notification tone="error" message={error} notificationKey={retry} action={{ label: "Check indexing status", onClick: () => { if (!pending) setRetry(value => value + 1); } }} />
  </div>;
}
