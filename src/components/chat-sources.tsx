"use client";

import { Notification } from "./notification-toast";

import { useEffect, useId, useState, type KeyboardEvent } from "react";
import { FileText } from "lucide-react";
import type { ChatSource } from "@inkspect/core/lib/chat-context";
import { isReviewReference, isKnowledgeReference, type ChatReference, type ChatReviewReference, type ChatKnowledgeReference } from "@inkspect/core/lib/chat-review-evidence";
import { ReviewDiagram } from "./review-report";
import { productFetch } from "@inkspect/core/lib/api-client";
import styles from "./chat-sources.module.css";

type Citation = Omit<ChatSource, "content">;
type Scope = { organizationId: string; conversationId: string; messageId: string };

export function ChatSources({ sources, ...scope }: Scope & { sources: ChatReference[] }) {
  const files = sources.filter((source): source is Citation => !isReviewReference(source) && !isKnowledgeReference(source));
  const references = sources.filter(source => isReviewReference(source) || isKnowledgeReference(source));
  return <div className={styles.sources} aria-label="Answer sources">
    {!!files.length && <FileSources key={`${scope.organizationId}:${scope.conversationId}:${scope.messageId}`} sources={files} {...scope} />}
    {!!references.length && <ul className={styles.references}>{references.map(source => <li key={`${scope.organizationId}:${scope.conversationId}:${scope.messageId}:${source.id}`}>
      {isReviewReference(source) ? <ReviewSource source={source} /> : isKnowledgeReference(source) ? <KnowledgeSource source={source} {...scope} /> : null}
    </li>)}</ul>}
  </div>;
}

function FileSources({ sources, ...scope }: Scope & { sources: Citation[] }) {
  const id = useId();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = sources.find(source => source.id === selectedId);
  function navigate(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number;
    if (event.key === "ArrowRight") next = (index + 1) % sources.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + sources.length) % sources.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = sources.length - 1;
    else return;
    event.preventDefault();
    event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[next]?.focus();
  }
  return <div className={styles.fileSources}>
    <div className={styles.tabs} role="group" aria-label="Source files">
      {sources.map((source, index) => {
        const filename = source.path.split("/").pop() || source.path;
        const duplicate = sources.some(other => other.id !== source.id && other.path.split("/").pop() === filename);
        const label = `${source.id}: ${source.repository}/${source.path}, lines ${source.startLine}–${source.endLine}`;
        return <button key={source.id} type="button" id={`${id}-source-${source.id}`} aria-controls={selectedId === source.id ? `${id}-panel` : undefined} aria-expanded={source.id === selectedId} aria-label={label} title={label} className={styles.tab} onClick={() => setSelectedId(current => current === source.id ? null : source.id)} onKeyDown={event => navigate(event, index)}>
          <FileText size={14} aria-hidden="true" /><span className={styles.filename}>{filename}</span>{duplicate && <span className={styles.tabReference}>{source.id} · {source.startLine}–{source.endLine}</span>}
        </button>;
      })}
    </div>
    {selected && <div className={styles.filePanel} role="region" id={`${id}-panel`} aria-labelledby={`${id}-source-${selected.id}`} tabIndex={0}>
      <div className={styles.fileHeader}><FileText size={14} aria-hidden="true" /><span className={styles.filePath} title={`${selected.repository}/${selected.path}`}>{selected.path}<small>{selected.repository}</small></span><span className={styles.fileLocation}><span className={styles.badge}>{selected.id}</span>Lines {selected.startLine}–{selected.endLine}</span></div>
      <SourcePreview key={`${selected.id}:${selected.repository}:${selected.path}:${selected.revision}:${selected.startLine}:${selected.endLine}`} source={selected} {...scope} />
    </div>}
  </div>;
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
    <Notification tone="error" message={error} notificationKey={attempt} action={{ label: "Retry loading snippet", onClick: () => { setContent(null); setError(""); setAttempt(value => value + 1); } }} />
    <div className={styles.codeViewport} aria-busy={content === null && !error}>
      {content === null && !error && <p className={styles.status} role="status">Loading snippet…</p>}
      {error && <div className={styles.status}><p>Snippet unavailable.</p><button type="button" onClick={() => { setError(""); setAttempt(value => value + 1); }}>Retry</button></div>}
      {lines && <pre className={styles.code} tabIndex={0} aria-label={`${source.path}, lines ${source.startLine} to ${source.endLine}`}><code>{lines.map((line, index) => <span className={styles.line} key={index}><span className={styles.lineNumber} aria-hidden="true">{source.startLine + index}</span><span>{line || "\u200b"}</span>{index < lines.length - 1 ? "\n" : ""}</span>)}</code></pre>}
    </div>
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
