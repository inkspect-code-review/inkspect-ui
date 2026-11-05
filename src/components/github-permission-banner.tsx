"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUpRight, GitPullRequest, LoaderCircle } from "lucide-react";
import { Notification } from "./notification-toast";
import { productFetch } from "@inkspect/core/lib/api-client";
import styles from "./github-permission-banner.module.css";

type Connection = { installation_id: string; account: string; contents: string | null; installation_url: string | null; checked_at: string | null; unavailable: boolean };
type State = { connections: Connection[]; can_manage: boolean };

export function GitHubPermissionBanner({ organizationId }: { organizationId: string }) {
  const [state, setState] = useState<State | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<"success" | "info" | "error">("info");
  const controller = useRef<AbortController | null>(null);
  const pending = useRef(false);
  const endpoint = `/api/review-settings?${new URLSearchParams({ organizationId, view: "github-permissions" })}`;
  const load = useCallback(async (installationId?: string) => {
    const response = await productFetch(endpoint, { cache: "no-store", signal: controller.current?.signal,
      ...(installationId ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ installationId }) } : {}) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Could not check GitHub permissions.");
    // A rolling release may briefly route this request to the previous API.
    if (!Array.isArray(data.connections) || typeof data.can_manage !== "boolean") throw new Error("GitHub permission status is temporarily unavailable.");
    if (!controller.current?.signal.aborted) setState(data);
    return data as State;
  }, [endpoint]);
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    // These reads only consult saved permissions. GitHub checks run in the
    // background or after the user explicitly chooses Check again.
    const refresh = () => { if (!document.hidden && !pending.current) void load().catch(() => {}); };
    refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => { abort.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [load]);
  async function recheck(id: string) {
    if (pending.current) return;
    pending.current = true; setChecking(id); setMessage("");
    try {
      const result = await load(id);
      if (!controller.current?.signal.aborted) {
        const ready = result.connections.find(c => c.installation_id === id)?.contents === "write";
        setTone(ready ? "success" : "info");
        setMessage(ready ? "GitHub access updated. AI fixes are ready." : "Approval is still pending. A GitHub account or organization owner needs to approve the new permissions.");
      }
    } catch (error) {
      if (!controller.current?.signal.aborted) { setTone("error"); setMessage(error instanceof Error ? error.message : "Could not check permissions."); }
    } finally { pending.current = false; if (!controller.current?.signal.aborted) setChecking(null); }
  }
  const needed = state?.connections.filter(c => c.checked_at && !c.unavailable && c.contents !== "write") ?? [];
  if (!needed.length) return <Notification tone={tone} message={message} />;
  return <aside className={styles.banner} aria-label="GitHub permission update">
    <GitPullRequest size={20} className={styles.icon} aria-hidden="true" />
    <div className={styles.content}>
      <strong>Enable AI fixes with updated GitHub access</strong>
      <p>Inkspect needs permission to write code so it can commit fixes to your existing PR branch. Reviews keep working. Granting access does not turn on Auto fix.</p>
      <div className={styles.accounts}>{needed.map(connection => <div className={styles.account} key={connection.installation_id}>
        <span>{connection.account}</span>
        {state?.can_manage && connection.installation_url ? <>
          <a href={connection.installation_url} target="_blank" rel="noopener noreferrer">Review permissions<ArrowUpRight size={14} aria-hidden="true" /></a>
          <button type="button" disabled={!!checking} onClick={() => void recheck(connection.installation_id)}>
            {checking === connection.installation_id && <LoaderCircle size={14} className={styles.spinner} aria-hidden="true" />}
            {checking === connection.installation_id ? "Checking…" : "Check again"}
          </button>
        </> : <small>Ask a workspace admin and GitHub account owner to approve access.</small>}
      </div>)}</div>
      <Notification tone={tone} message={message} />
    </div>
  </aside>;
}
