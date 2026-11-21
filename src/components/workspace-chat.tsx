"use client";

import { ConfirmationDialog } from "./confirmation-dialog";

import { Notification, useNotifications } from "./notification-toast";
import { chatProgressLabels, type ChatProgress } from "@inkspect/core/lib/chat-progress";
import { consumeChatStream } from "@inkspect/core/lib/chat-stream";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { Repository } from "@inkspect/core/lib/github";
import type { ChatConversation, ChatDetail } from "@inkspect/core/lib/workspace-chat";
import { DashboardIcon } from "./dashboard-icon";
import { ChatMarkdown, ChatCopyButton } from "./chat-markdown";
import { ChatRepositoryPicker } from "./chat-repository-picker";
import { ChatIndexAction } from "./chat-index-action";
import { ChatSources } from "./chat-sources";
import { useChatWindow } from "./chat-window-provider";
import { useChatWindowFrame, isMobileChat } from "./use-chat-window-frame";
import { resizeDirections } from "@inkspect/core/lib/chat-window-geometry";
import { chatDraftKey } from "@inkspect/core/lib/chat-window-state";
import styles from "./workspace-chat.module.css";

export function WorkspaceChatLauncher({ scopeKey, panelId, compact = false }: { scopeKey: string; panelId: string; compact?: boolean }) {
  const [window, setWindow] = useChatWindow(scopeKey);
  return <button id={`${panelId}-launcher`} className={styles.launcher} data-compact={compact} type="button" onClick={() => setWindow({ open: !window.open })} aria-expanded={window.open} aria-pressed={window.open} aria-controls={panelId} aria-label={window.open ? "Ask AI — close chat" : "Ask AI — open chat"} title={compact ? undefined : window.open ? "Close AI chat" : "Open AI chat"} data-sidebar-tooltip={window.open ? "Ask AI · Close chat" : "Ask AI · Open chat"}><span className={styles.launcherIcon}><Image src="/brand/inkspect-symbol-white.svg" alt="" width={16} height={20} className={styles.mark} />{window.open && <i className={styles.activeDot} />}</span><span className={styles.launcherLabel}>Ask AI</span><span className={styles.launcherAction} aria-hidden="true">{window.open ? <><span className={styles.openLabel}>Open</span><DashboardIcon name="close" /></> : "↗"}</span></button>;
}

type Props = { scopeKey: string; panelId: string; organizationId: string; organizationName: string; repositories: Repository[] };
export function WorkspaceChat({ scopeKey, panelId, organizationId, organizationName, repositories }: Props) {
  const [window, setWindow] = useChatWindow(scopeKey);
  const { panel: panelRef, style: frameStyle, interacting, handlers: frameHandlers, mobile } = useChatWindowFrame(window.frame, window.expanded, window.open, setWindow);
  const { notify } = useNotifications();
  const [detail, setDetail] = useState<ChatDetail | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyView, setHistoryView] = useState<"mine" | "team">("mine");
  const [history, setHistory] = useState<ChatConversation[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [activity, setActivity] = useState<ChatProgress | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [historyVersion, setHistoryVersion] = useState(0);
  const [detailVersion, setDetailVersion] = useState(0);
  const input = useRef<HTMLTextAreaElement>(null);
  const conversation = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const lastRequest = useRef<{ content: string; conversationId: string | null; repositoryScope: string; id: string } | null>(null);
  const busy = pending || loading;
  // A selected chat stays read-only until its ownership has been loaded.
  const sharedConversation = !!detail && !detail.conversation.owner;
  const readOnly = !!window.conversationId && !detail?.conversation.owner;
  const currentScope = detail?.conversation.repositoryScope ?? window.repositoryScope;
  const repositoryName = currentScope === "all" ? "All repositories" : repositories.find((repo) => String(repo.id) === currentScope)?.fullName ?? "Previously connected repository";

  const request = useCallback(async <T,>(method: string, body?: object, query?: Record<string, string>, signal?: AbortSignal): Promise<T> => {
    const params = new URLSearchParams({ organizationId, ...query });
    const response = await productFetch(`/api/workspace-chat?${params}`, { method, credentials: "same-origin", cache: "no-store", signal, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Couldn’t load this conversation.");
    return result as T;
  }, [organizationId]);

  const minimize = useCallback(() => {
    setWindow({ open: false });
    if (opener.current?.isConnected) opener.current.focus();
    else document.getElementById(`${panelId}-launcher`)?.focus();
  }, [setWindow, panelId]);

  useEffect(() => {
    if (!window.open) return;
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (isMobileChat()) panelRef.current?.focus({preventScroll:true});
    else input.current?.focus({preventScroll:true});
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented && !document.querySelector('dialog[open], [data-radix-popper-content-wrapper]')) { event.preventDefault(); minimize(); }
    };
    document.addEventListener("keydown", escape);
    return () => document.removeEventListener("keydown", escape);
  }, [window.open, minimize, panelRef]);
  useEffect(() => () => mutation.current?.abort(), []);
  useEffect(() => {
    if (window.open && conversation.current) conversation.current.scrollTop = conversation.current.scrollHeight;
  }, [window.open, detail?.messages.length, streamingText, activity]);

  useEffect(() => {
    if (!window.open || !window.conversationId || mutation.current) return;
    const controller = new AbortController();
    const id = window.conversationId;
    async function load() {
      setLoading(true); setError(""); setConfirmDelete(false);
      try { setDetail(await request<ChatDetail>("GET", undefined, { conversationId: id! }, controller.signal)); }
      catch (error) { reportBrowserError("browser.workspace.chat", error); if (!controller.signal.aborted) { setDetail(null); setError(error instanceof Error ? error.message : "Couldn’t load this conversation."); } }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [request, window.open, window.conversationId, detailVersion]);

  useEffect(() => {
    if (!window.open || !historyOpen) return;
    const controller = new AbortController();
    async function load() {
      setHistoryLoading(true); setError("");
      try {
        const result = await request<{ conversations: ChatConversation[]; hasMore: boolean }>("GET", undefined, { view: historyView }, controller.signal);
        setHistory(result.conversations); setHasMore(result.hasMore);
      } catch (error) { reportBrowserError("browser.workspace.chat", error); if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Couldn’t load chats."); }
      finally { if (!controller.signal.aborted) setHistoryLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [request, window.open, historyOpen, historyView, historyVersion]);

  // Revalidate shared conversations while open, including after returning to
  // the tab. Unsharing/revoked membership must remove the displayed content.
  useEffect(() => {
    if (!window.open || !window.conversationId || !sharedConversation) return;
    const controller = new AbortController();
    const revalidate = async () => {
      try { setDetail(await request<ChatDetail>("GET", undefined, { conversationId: window.conversationId! }, controller.signal)); }
      catch (diagnosticError) { reportBrowserError("browser.workspace.chat", diagnosticError); if (!controller.signal.aborted) { setDetail(null); setError("This shared conversation is no longer available."); } }
    };
    const timer = setInterval(revalidate, 20_000);
    globalThis.addEventListener("focus", revalidate);
    return () => { clearInterval(timer); globalThis.removeEventListener("focus", revalidate); controller.abort(); };
  }, [request, window.open, window.conversationId, sharedConversation]);

  function newChat() {
    lastRequest.current = null;
    mutation.current?.abort(); mutation.current=null;setStreamingText("");setActivity(null);
    setWindow({ open: true, conversationId: null });
    setDetail(null); setError(""); setNotice(""); setHistoryOpen(false); setConfirmDelete(false); setLoading(false); setPending(false);
    if (isMobileChat()) panelRef.current?.focus({preventScroll:true});
    else input.current?.focus({preventScroll:true});
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const content = window.draft.trim();
    if (!content || busy || readOnly) return;
    const controller = new AbortController(); mutation.current = controller;
    if (!lastRequest.current || lastRequest.current.content !== content || lastRequest.current.conversationId !== window.conversationId || lastRequest.current.repositoryScope !== window.repositoryScope) lastRequest.current = { content, conversationId: window.conversationId, repositoryScope: window.repositoryScope, id: crypto.randomUUID() };
    setPending(true); setError(""); setNotice(""); setStreamingText(""); setActivity("thinking");
    try {
      const response=await productFetch(`/api/workspace-chat?${new URLSearchParams({organizationId})}`,{method:"POST",signal:controller.signal,headers:{"Content-Type":"application/json"},body:JSON.stringify({stream:true,content,requestId:lastRequest.current.id,...(window.conversationId?{conversationId:window.conversationId}:{repositoryScope:window.repositoryScope})})});
      await consumeChatStream(response,event=>{
        if(controller.signal.aborted)return;
        if(event.event==="progress"){setActivity(event.data.stage);return;}
        if(event.event==="delta"){setActivity(null);setStreamingText(previous=>previous+event.data.text);return;}
        const result=event.data;
        setDetail(previous=>({conversation:result.conversation,messages:[...(previous?.conversation.id===result.conversation.id?previous.messages.filter(m=>m.id!==result.message.id&&m.id!==result.assistantMessage?.id):[]),result.message,...(result.assistantMessage?[result.assistantMessage]:[])]}));
        setWindow({conversationId:result.conversation.id,draft:""});
        if(event.event!=="accepted") {setActivity(null);setStreamingText("");lastRequest.current=null;}
        if(result.replyError)setError(result.replyError);
      });
      setHistoryVersion((value) => value + 1);
    } catch (error) { reportBrowserError("browser.workspace.chat", error); if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Couldn’t save your question."); }
    finally { if (!controller.signal.aborted) { mutation.current=null;setStreamingText("");setActivity(null);setPending(false); if (!isMobileChat()) input.current?.focus({preventScroll:true}); } }
  }
  async function share() {
    if (!detail?.conversation.owner || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setPending(true); setError(""); setNotice("");
    try {
      const result = await request<{ conversation: ChatConversation }>("PATCH", { conversationId: detail.conversation.id, shared: !detail.conversation.shared }, undefined, controller.signal);
      setDetail((previous) => previous && { ...previous, conversation: result.conversation });
      setNotice(result.conversation.shared ? "Shared with your workspace. Teammates can read this conversation in Team chats." : "This conversation is private again.");
      setHistoryVersion((value) => value + 1);
    } catch (error) { reportBrowserError("browser.workspace.chat", error); if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Couldn’t change sharing."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  async function deleteChat() {
    if (!detail?.conversation.owner || busy) return;
    const controller = new AbortController(); mutation.current = controller;
    setPending(true); setError("");
    try { await request("DELETE", { conversationId: detail.conversation.id }, undefined, controller.signal); setWindow({ draft: "" }); newChat(); setHistoryVersion((value) => value + 1); }
    catch (error) { reportBrowserError("browser.workspace.chat", error); if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Couldn’t delete this chat."); }
    finally { if (!controller.signal.aborted) setPending(false); }
  }
  async function loadMore() {
    setHistoryLoading(true);
    try {
      const result = await request<{ conversations: ChatConversation[]; hasMore: boolean }>("GET", undefined, { view: historyView, offset: String(history.length) });
      setHistory((previous) => [...previous, ...result.conversations.filter((item) => !previous.some((old) => old.id === item.id))]); setHasMore(result.hasMore);
    } catch (diagnosticError) { reportBrowserError("browser.workspace.chat", diagnosticError); setError("Couldn’t load more conversations."); }
    finally { setHistoryLoading(false); }
  }

  return <section tabIndex={-1} ref={panelRef} style={frameStyle} id={panelId} className={styles.window} data-interacting={interacting} data-expanded={window.expanded} hidden={!window.open} role="dialog" aria-modal="false" aria-labelledby={`${panelId}-title`}>
    <header className={styles.header}>
      <div className={styles.dragHandle} role="button" tabIndex={mobile || window.expanded ? -1 : 0} aria-disabled={mobile || window.expanded} aria-label="Move chat window" title="Drag to move · Arrow keys to move" {...frameHandlers("move")}>
      <Image className={styles.mark} src="/brand/inkspect-symbol-white.svg" alt="" width={22} height={28} />
      <div className={styles.title}><h2 id={`${panelId}-title`}>Ask AI</h2><p>{organizationName}</p></div>
      </div>
      <button className={styles.iconButton} type="button" disabled={pending} onClick={() => { setHistoryOpen(!historyOpen); setError(""); }} aria-label="Chat history" aria-pressed={historyOpen}><DashboardIcon name="history" /></button>
      <button className={styles.iconButton} type="button" onClick={newChat} disabled={pending} aria-label="New chat"><DashboardIcon name="plus" /></button>
      <button className={`${styles.iconButton} ${styles.expandButton}`} type="button" onClick={() => setWindow({ expanded: !window.expanded })} aria-label={window.expanded ? "Reduce chat window" : "Expand chat window"}><DashboardIcon name={window.expanded ? "collapse" : "expand"} /></button>
      <button className={styles.iconButton} type="button" onClick={minimize} aria-label="Minimize chat"><DashboardIcon name="minus" /></button>
    </header>
    {historyOpen ? <div className={styles.history}>
      <div className={styles.historyTabs} role="group" aria-label="Conversation visibility"><button type="button" aria-pressed={historyView === "mine"} onClick={() => { if (historyView !== "mine") { setHistory([]); setHistoryView("mine"); } }}>My chats</button><button type="button" aria-pressed={historyView === "team"} onClick={() => { if (historyView !== "team") { setHistory([]); setHistoryView("team"); } }}>Team chats</button></div>
      {historyLoading && !history.length && <p className={styles.hint} role="status">Loading conversations…</p>}
      {!historyLoading && !history.length && <p className={styles.hint}>{historyView === "mine" ? "Your conversations will appear here." : "Conversations shared with the team will appear here."}</p>}
      <ul className={styles.historyList}>{history.map((chat) => <li key={chat.id}><button type="button" onClick={() => { setDetail(null); setDetailVersion((value) => value + 1); setWindow({ conversationId: chat.id }); setHistoryOpen(false); setNotice(""); }}><span><span className={styles.historyTitle}><strong>{chat.title}</strong>{chat.owner && !!window.drafts[chatDraftKey(chat.id)]?.trim() && <span className={styles.draftBadge}>Draft</span>}</span><small>{chat.owner ? "You" : chat.authorName} · {chat.shared ? "Shared with team" : "Private"}</small></span><DashboardIcon name={chat.shared ? "share" : "lock"} /></button></li>)}</ul>
      {hasMore && <button className={styles.loadMore} type="button" disabled={historyLoading} onClick={loadMore}>Load more</button>}
    </div> : <>
      <div className={styles.scopeBar}><DashboardIcon name="repositories" />{!window.conversationId ? <ChatRepositoryPicker repositories={repositories} value={window.repositoryScope} disabled={busy} onChange={repositoryScope => setWindow({repositoryScope})} /> : <span className={styles.scopeName} title={repositoryName}>{repositoryName}</span>}<span className={styles.visibility}><DashboardIcon name={detail?.conversation.shared ? "share" : "lock"} />{detail?.conversation.shared ? "Team" : "Private"}</span></div>
      {detail?.conversation && <div className={styles.conversationBar}><span title={detail.conversation.title}>{detail.conversation.title}</span>{detail.conversation.owner && <><button type="button" className={styles.shareButton} disabled={busy} onClick={share}><DashboardIcon name={detail.conversation.shared ? "lock" : "share"} />{detail.conversation.shared ? "Make private" : "Share with team"}</button>
        <ConfirmationDialog open={confirmDelete} onOpenChange={setConfirmDelete} title="Delete this conversation?"
          description="This conversation will be deleted for everyone. This can’t be undone." confirmLabel="Delete conversation" busy={busy} onConfirm={() => void deleteChat()}
          trigger={<button className={styles.iconButton} type="button" disabled={busy} aria-label="Delete conversation"><DashboardIcon name="trash" /></button>} />
      </>}</div>}
      <div className={styles.messages} ref={conversation} aria-busy={loading}>
        {!window.conversationId && <div className={styles.welcome}><div className={styles.welcomeMark}><Image className={styles.mark} src="/brand/inkspect-symbol-white.svg" alt="" width={32} height={40} /></div><h3>Your code, in conversation.</h3><p>Ask across your workspace or focus on one repository.</p><div className={styles.prompts}>{["How are these repositories connected?", "Where is authentication handled?", "Explain the main architecture."].map((prompt) => <button type="button" key={prompt} onClick={() => { setWindow({ draft: prompt }); input.current?.focus(); }}>{prompt}<DashboardIcon name="arrow" /></button>)}</div></div>}
        {loading && !detail && <p className={styles.hint} role="status">Loading conversation…</p>}
        <div role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions">{detail?.messages.map((message) => <article className={styles.message} data-role={message.role === "assistant" ? "assistant" : "user"} aria-label={message.role === "assistant" ? "AI response" : "User message"} key={message.id}>{message.role === "assistant" ? <ChatMarkdown content={message.content} className={styles.markdown} taskContext={detail.conversation.owner && message.sources?.length ? { sources: message.sources, repositories } : undefined} /> : <p>{message.content}</p>}{!!message.sources?.length && <ChatSources sources={message.sources} organizationId={organizationId} conversationId={detail.conversation.id} messageId={message.id} />}{detail.conversation.owner && message.role === "assistant" && message.actions?.map(action => <ChatIndexAction key={action.repositoryId} action={action} organizationId={organizationId} />)}
          {message.role === "assistant" && <ChatCopyButton content={message.content} className={styles.iconButton} notify={notify} />}
        </article>)}</div>
        {pending && activity && !streamingText && <article className={styles.message} data-role="assistant"><div className={styles.activity} role="status" aria-live="polite" aria-atomic="true"><span className={styles.activityText}>{chatProgressLabels[activity]}</span></div></article>}
        {streamingText && <article className={styles.message} data-role="assistant" aria-label="AI is responding"><ChatMarkdown content={streamingText} className={styles.markdown} /></article>}
      </div>
      <Notification tone="info" message={notice} />
      {readOnly ? <div className={styles.readOnly}><DashboardIcon name="share" /><span>{loading ? "Loading…" : "Shared conversations are read-only."}</span><button type="button" onClick={newChat}>Start your own</button></div> : <form className={styles.composer} onSubmit={submit}><label className={styles.srOnly} htmlFor={`${panelId}-question`}>Your question</label><textarea id={`${panelId}-question`} ref={input} value={window.draft} disabled={pending} placeholder="Ask about your repositories…" rows={3} onChange={(event) => setWindow({ draft: event.target.value })} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><div className={styles.composerFooter}><span>{pending ? (streamingText ? "Responding…" : "Working…") : "Enter to send · Shift + Enter for a new line"}</span><button type="submit" disabled={busy || !window.draft.trim()} aria-label={pending ? "Waiting for reply" : "Send question"} title="Send question"><DashboardIcon name={pending ? "history" : "send"} /></button></div></form>}
    </>}
    <Notification tone="error" message={error} />
    {!mobile && !window.expanded && resizeDirections.map((direction) => <button key={direction} type="button" className={styles.resizeHandle} data-direction={direction} aria-label={`Resize chat from ${({ n: "top", e: "right", s: "bottom", w: "left", ne: "top right", se: "bottom right", sw: "bottom left", nw: "top left" })[direction]}`} title="Drag to resize · Arrow keys to resize" {...frameHandlers(direction)} />)}
  </section>;
}
