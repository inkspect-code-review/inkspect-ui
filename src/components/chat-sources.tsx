"use client";

import { Notification } from "./notification-toast";

import { useEffect, useState } from "react";
import type { ChatSource } from "@inkspect/core/lib/chat-context";
import { isReviewReference, isKnowledgeReference, type ChatReference, type ChatReviewReference, type ChatKnowledgeReference } from "@inkspect/core/lib/chat-review-evidence";
import { ReviewDiagram } from "./review-report";
import { productFetch } from "@inkspect/core/lib/api-client";
import styles from "./chat-sources.module.css";

type Citation = Omit<ChatSource, "content">;
type Scope = { organizationId: string; conversationId: string; messageId: string };

export function ChatSources({ sources, ...scope }: Scope & { sources: ChatReference[] }) {
  return <ul className={styles.sources} aria-label="Answer sources">{sources.map(source => <li key={`${scope.organizationId}:${scope.conversationId}:${scope.messageId}:${source.id}`}>
    {isReviewReference(source) ? <ReviewSource source={source} /> : isKnowledgeReference(source) ? <KnowledgeSource source={source} {...scope} /> : <SourceDisclosure source={source} {...scope} />}
  </li>)}</ul>;
}

function SourceDisclosure({ source, ...scope }: Scope & { source: Citation }) {
  const [open, setOpen] = useState(false);
  return <details className={styles.source} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary><span className={styles.badge}>{source.id}</span><span className={styles.path}>{source.repository}/{source.path}<small>Lines {source.startLine}–{source.endLine}</small></span><span className={styles.action}>{open ? "Hide chunk" : "Show chunk"}</span></summary>
    {open && <SourcePreview source={source} {...scope} />}
  </details>;
}

function SourcePreview({ source, organizationId, conversationId, messageId }: Scope & { source: Citation }) {
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const sourceId = source.id;
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const params = new URLSearchParams({ organizationId, conversationId, messageId, sourceId });
        const response = await productFetch(`/api/workspace-chat?${params}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Couldn’t load this snippet.");
        if (typeof result.source?.content !== "string") throw new Error("Couldn’t load this snippet.");
        if (!controller.signal.aborted) setContent(result.source.content);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Couldn’t load this snippet.");
      }
    }
    void load();
    return () => controller.abort();
  }, [organizationId, conversationId, messageId, sourceId, attempt]);

  const lines = content?.replace(/\r\n/g, "\n").replace(/\n$/, "").split("\n");
  return <div className={styles.preview}>
    <div className={styles.toolbar}><span title={source.revision}>Revision {source.revision.slice(0, 7)}</span><a href={source.url} target="_blank" rel="noopener noreferrer">Open on GitHub ↗</a></div>
    {content === null && !error && <p className={styles.status} role="status">Loading chunk…</p>}
    <Notification tone="error" message={error} notificationKey={attempt} action={{ label: "Retry loading snippet", onClick: () => { setContent(null); setError(""); setAttempt(value => value + 1); } }} />
    {lines && <pre className={styles.code} tabIndex={0} aria-label={`${source.path}, lines ${source.startLine} to ${source.endLine}`}><code>{lines.map((line, index) => <span className={styles.line} key={index}><span className={styles.lineNumber} aria-hidden="true">{source.startLine + index}</span><span>{line || "\u200b"}</span>{index < lines.length - 1 ? "\n" : ""}</span>)}</code></pre>}
  </div>;
}

function ReviewSource({source}:{source:ChatReviewReference}) {
 return <div className={styles.source}><div className={styles.toolbar}><span className={styles.badge}>{source.id}</span><a href={source.url}>{source.repository} · PR #{source.pullNumber}</a><span>{source.createdAt.slice(0,10)}</span></div>{source.diagram && <ReviewDiagram diagram={source.diagram} />}</div>;
}

function KnowledgeSource({source,organizationId,conversationId,messageId}:Scope & {source:ChatKnowledgeReference}) {
 const [open,setOpen]=useState(false),[content,setContent]=useState<string|null>(null),[error,setError]=useState("");
 useEffect(()=>{
  if(!open)return;
  const controller=new AbortController();
  const params=new URLSearchParams({organizationId,conversationId,messageId,sourceId:source.id});
  productFetch(`/api/workspace-chat?${params}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
   const value=await response.json();if(!response.ok || typeof value.source?.content!=="string")throw new Error(value.error||"Could not load this document.");
   if(!controller.signal.aborted)setContent(value.source.content);
  }).catch(error=>{if(!controller.signal.aborted)setError(error.message);});
  return ()=>controller.abort();
 },[open,organizationId,conversationId,messageId,source.id]);
 return <details className={styles.source} onToggle={event=>setOpen(event.currentTarget.open)}><summary><span className={styles.badge}>{source.id}</span><span className={styles.path}>{source.title}<small>Knowledge Center · Lines {source.startLine}–{source.endLine}</small></span><span className={styles.action}>{open?"Hide rule":"Show rule"}</span></summary>{open && <div className={styles.preview}><div className={styles.toolbar}><a href={source.url}>Open document ↗</a></div>{error?<Notification tone="error" message={error} />:content===null?<p role="status">Loading document…</p>:<pre className={styles.code} tabIndex={0}>{content}</pre>}</div>}</details>;
}
