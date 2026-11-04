"use client";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { knowledgeContentLimit, knowledgeTitleLimit, markdownFileTitle, validateKnowledgeDocument, type KnowledgeDocument, type KnowledgeDocumentSummary } from "@inkspect/core/lib/knowledge";
import { knowledgeTemplates, type KnowledgeTemplate } from "@inkspect/core/lib/knowledge-templates";
import { DashboardIcon } from "./dashboard-icon";
import { ChatMarkdown } from "./chat-markdown";
import shared from "./dashboard.module.css";
import styles from "./knowledge-center.module.css";

export function KnowledgeCenter({ organizationId, canManage }: { organizationId: string; canManage: boolean }) {
  const [documents, setDocuments] = useState<KnowledgeDocumentSummary[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [saved, setSaved] = useState("");
  const [mode, setMode] = useState<"create" | "read" | "edit">("create");
  const [preview, setPreview] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [filename, setFilename] = useState("");
  const [templateLanguage, setTemplateLanguage] = useState("");
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [pending, setPending] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const [readingClipboard, setReadingClipboard] = useState(false);
  const [pasteHint, setPasteHint] = useState("");
  const [detail, setDetail] = useState<KnowledgeDocument | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRequest = useRef<AbortController | null>(null);
  const detailRequest = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const fileReadVersion = useRef(0);
  const endpoint = `/api/knowledge?organizationId=${encodeURIComponent(organizationId)}`;
  const busy = pending || readingFile || readingClipboard;

  const load = useCallback((offset = 0) => {
    listRequest.current?.abort();
    const controller = new AbortController();
    listRequest.current = controller;
    return productFetch(`${endpoint}&offset=${offset}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t load documents. Please try again.");
      if (controller.signal.aborted) return;
      setListError("");
      setDocuments((current) => offset ? [...current, ...result.documents.filter((item: KnowledgeDocumentSummary) => !current.some((existing) => existing.id === item.id))] : result.documents);
      setHasMore(result.hasMore);
    }).catch((cause: unknown) => { reportBrowserError("browser.knowledge.center", cause);
      if (!controller.signal.aborted) setListError(cause instanceof Error ? cause.message : "Couldn’t load documents. Please try again.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
  }, [endpoint]);

  useEffect(() => {
    if (mode !== "read" && dialogRef.current?.open) titleRef.current?.focus();
  }, [mode]);

  function reload(offset = 0) {
    setLoading(true); setListError("");
    void load(offset);
  }

  function openCreate(template?: KnowledgeTemplate) {
    if (!canManage || busy) return;
    setMode("create"); setPreview(false); setConfirmDelete(false); setDetail(null); setTitle(template?.title ?? ""); setContent(template?.content ?? ""); setTemplateLanguage(template?.language ?? ""); setFilename(""); setError(""); setFileError(""); setPasteHint(""); setSaved("");
    if (fileRef.current) fileRef.current.value = "";
    dialogRef.current?.showModal();
    titleRef.current?.focus();
  }

  const openDocument = useCallback(async (id: string) => {
    setMode("read"); setPreview(true); setConfirmDelete(false); setDetail(null); setError(""); setSaved(""); setDetailLoading(true);
    dialogRef.current?.showModal();
    detailRequest.current?.abort();
    const controller = new AbortController();
    detailRequest.current = controller;
    try {
      const response = await productFetch(`${endpoint}&documentId=${encodeURIComponent(id)}`, { cache: "no-store", signal: controller.signal });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t open this document. Close it and try again.");
      if (!controller.signal.aborted) setDetail(result.document);
    } catch (cause) { reportBrowserError("browser.knowledge.center", cause);
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Couldn’t open this document. Close it and try again.");
    } finally { if (!controller.signal.aborted) setDetailLoading(false); }
  }, [endpoint]);

  useEffect(() => {
    const fileReads=fileReadVersion;let active=true;
    void load().then(() => {
      const id=new URLSearchParams(window.location.search).get("documentId");
      if(active && id && id.length<=100)void openDocument(id);
    });
    return () => {active=false;listRequest.current?.abort();detailRequest.current?.abort();fileReads.current++;};
  }, [load,openDocument]);

  function startEditing() {
    if (!canManage || !detail || busy) return;
    setTitle(detail.title); setContent(detail.content); setFilename(""); setTemplateLanguage("");
    setError(""); setFileError(""); setPasteHint(""); setSaved(""); setConfirmDelete(false); setPreview(false); setMode("edit");
  }

  function cancelEditing() {
    setError(""); setFileError(""); setPasteHint(""); setMode("read"); setPreview(true);
  }

  async function deleteDocument() {
    if (!canManage || !detail || !confirmDelete || savingRef.current || busy) return;
    savingRef.current = true; setPending(true); setError("");
    try {
      const response = await productFetch(`${endpoint}&documentId=${encodeURIComponent(detail.id)}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t delete this document. Please try again.");
      setDocuments((current) => current.filter((item) => item.id !== detail.id));
      setSaved("Document deleted."); setConfirmDelete(false);
      dialogRef.current?.close();
      reload();
    } catch (cause) { reportBrowserError("browser.knowledge.center", cause);
      setError(cause instanceof Error ? cause.message : "Couldn’t delete this document. Please try again.");
    } finally { savingRef.current = false; setPending(false); }
  }

  async function upload(file?: File) {
    if (!file || busy || savingRef.current) return;
    setFileError(""); setError(""); setPasteHint("");
    if (!/\.(md|markdown)$/i.test(file.name)) { setFileError("Choose a .md or .markdown file."); return; }
    if (file.size > knowledgeContentLimit) { setFileError("Choose a Markdown file under 64 KB."); return; }
    const version = ++fileReadVersion.current;
    setReadingFile(true);
    try {
      const text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      if (version !== fileReadVersion.current) return;
      const validation = validateKnowledgeDocument("Document", text);
      if (validation) { setFileError(validation); return; }
      setContent(text); setFilename(file.name);
      setTitle((current) => current.trim() ? current : markdownFileTitle(file.name));
    } catch (diagnosticError) { reportBrowserError("browser.knowledge.center", diagnosticError);
      if (version === fileReadVersion.current) setFileError("Couldn’t read this file. Choose a UTF-8 Markdown file.");
    } finally { if (version === fileReadVersion.current) setReadingFile(false); }
  }

  async function paste() {
    if (busy || savingRef.current) return;
    setPasteHint(""); setFileError(""); setError("");
    const selectionStart = contentRef.current?.selectionStart ?? content.length;
    const selectionEnd = contentRef.current?.selectionEnd ?? content.length;
    let caret: number | undefined;
    const version = ++fileReadVersion.current;
    setReadingClipboard(true);
    try {
      const text = await navigator.clipboard.readText();
      if (version !== fileReadVersion.current) return;
      if (!text.trim()) { setPasteHint("Your clipboard is empty. Copy some text and try again."); return; }
      const next = content.slice(0, selectionStart) + text + content.slice(selectionEnd);
      const validation = validateKnowledgeDocument("Document", next);
      if (validation) { setPasteHint(validation); return; }
      setContent(next);
      caret = selectionStart + text.length;
    } catch (diagnosticError) { reportBrowserError("browser.knowledge.center", diagnosticError);
      if (version === fileReadVersion.current) setPasteHint("Paste directly into the content field with ⌘V or Ctrl+V.");
    } finally {
      if (version === fileReadVersion.current) {
        setReadingClipboard(false);
        requestAnimationFrame(() => {
          if (version !== fileReadVersion.current || !dialogRef.current?.open) return;
          contentRef.current?.focus();
          contentRef.current?.setSelectionRange(caret ?? selectionStart, caret ?? selectionEnd);
        });
      }
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canManage || savingRef.current || busy || mode === "read" || (mode === "edit" && !detail)) return;
    const validation = validateKnowledgeDocument(title, content);
    if (validation) { setError(validation); return; }
    savingRef.current = true; setPending(true); setError("");
    try {
      const editing = mode === "edit";
      const response = await productFetch(editing ? `${endpoint}&documentId=${encodeURIComponent(detail!.id)}` : endpoint, { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, content }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t save this document. Please try again.");
      setDocuments((current) => editing ? current.map((item) => item.id === result.document.id ? result.document : item) : [result.document, ...current]);
      setSaved(editing ? "Changes saved." : "Document added.");
      if (editing) { setDetail(result.document); setMode("read"); setPreview(true); }
      else dialogRef.current?.close();
      reload();
    } catch (cause) { reportBrowserError("browser.knowledge.center", cause);
      setError(cause instanceof Error ? cause.message : "Couldn’t save this document. Check your connection and try again.");
    } finally { savingRef.current = false; setPending(false); }
  }

  return <section className={shared.panel} aria-label="Knowledge documents">
    <div className={shared.panelHeader}>
      <span>Documents</span>
      {canManage && <button type="button" className={shared.primaryButton} onClick={() => openCreate()}><DashboardIcon name="plus" />Add document</button>}
    </div>
    {canManage && <details className={styles.templates}>
      <summary className={styles.templatesSummary}>
        <span><strong>Start from a template</strong><span>Coding standards for {knowledgeTemplates.length} languages. Choose one to review and customize.</span></span>
        <DashboardIcon name="plus" className={styles.templatesExpand} />
        <DashboardIcon name="minus" className={styles.templatesCollapse} />
      </summary>
      <ul className={styles.templateList} aria-label="Coding standard templates">
        {knowledgeTemplates.map((template) => <li key={template.id}>
          <button type="button" className={styles.templateButton} onClick={() => openCreate(template)} disabled={busy} aria-haspopup="dialog" aria-label={`Use ${template.language} coding standards template`}>
            <span><strong>{template.language}</strong><span>{template.summary}</span></span>
            <DashboardIcon name="plus" />
          </button>
        </li>)}
      </ul>
    </details>}
    {saved && <p className={styles.success} role="status"><DashboardIcon name="check" />{saved}</p>}
    {listError && <div className={styles.listError}><p className={shared.error} role="alert">{listError}</p><button type="button" className={shared.secondaryButton} onClick={() => reload(documents.length)} disabled={loading}>Try again</button></div>}
    {loading && !documents.length ? <p className={styles.loading} role="status">Loading documents…</p> : !documents.length && !listError ? <div className={shared.emptyState}>
      <div className={shared.emptyArtwork}><DashboardIcon name="knowledge" /></div>
      <h2>Give every review the full picture.</h2>
      <p>Add your team’s conventions, architecture notes, and review guidelines. Write a document or upload a Markdown file.</p>
      {canManage ? <button type="button" className={shared.secondaryButton} onClick={() => openCreate()}><DashboardIcon name="plus" />Add your first document</button> : <p>Ask a workspace owner or admin to add a document.</p>}
    </div> : <ul className={styles.documents}>
      {documents.map((item) => <li key={item.id}><button type="button" className={styles.document} onClick={() => void openDocument(item.id)} aria-haspopup="dialog">
        <DashboardIcon name="documentation" />
        <span className={styles.documentText}><strong>{item.title}</strong><span>{item.excerpt}</span></span>
        <DashboardIcon name="arrow" />
      </button></li>)}
    </ul>}
    {hasMore && <div className={styles.loadMore}><button type="button" className={shared.secondaryButton} onClick={() => reload(documents.length)} disabled={loading}>{loading ? "Loading…" : "Load more documents"}</button></div>}
    <dialog ref={dialogRef} className={styles.dialog} aria-labelledby="knowledge-document-title" aria-describedby={mode !== "read" ? "knowledge-document-description" : undefined}
      onCancel={(event) => { if (busy) event.preventDefault(); }} onClose={() => { detailRequest.current?.abort(); fileReadVersion.current++; }}>
      <div className={styles.dialogHeading}>
        <h2 id="knowledge-document-title" title={mode === "read" ? detail?.title : undefined}>{mode === "create" ? "Add document" : mode === "edit" ? "Edit document" : detail?.title || "Document"}</h2>
        <button type="button" className={shared.iconButton} onClick={() => dialogRef.current?.close()} disabled={busy} aria-label="Close document"><DashboardIcon name="close" /></button>
      </div>
      {mode !== "read" ? <>
        <p id="knowledge-document-description" className={styles.description}>{mode === "edit" ? "Update the title or Markdown content. Changes are shared with your workspace." : templateLanguage ? `${templateLanguage} template. Customize the standards for your team.` : "Write, paste, or upload your team’s coding standards and guidelines."}</p>
        <form className={styles.editorForm} onSubmit={save} aria-busy={busy}>
          <div className={styles.editorBody}>
            <label htmlFor="knowledge-title">Title</label>
            <input ref={titleRef} className={styles.titleInput} id="knowledge-title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Engineering conventions" required maxLength={knowledgeTitleLimit} disabled={busy} />
            <div className={styles.importActions}>
              <input ref={fileRef} type="file" accept=".md,.markdown,text/markdown" hidden disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void upload(file); }} />
              <button type="button" className={shared.secondaryButton} onClick={() => { setPreview(false); void paste(); }} disabled={busy}><DashboardIcon name="clipboard" />{readingClipboard ? "Pasting…" : "Paste"}</button>
              <button type="button" className={shared.secondaryButton} onClick={() => { setPreview(false); fileRef.current?.click(); }} disabled={busy}><DashboardIcon name="upload" />{readingFile ? "Reading file…" : "Upload Markdown"}</button>
              {filename && <span className={styles.filename} role="status"><DashboardIcon name="check" />{filename}</span>}
            </div>
            {fileError && <p className={styles.error} role="alert">{fileError}</p>}
            {pasteHint && <p className={styles.pasteHint} role="status">{pasteHint}</p>}
            <div className={styles.contentLabel}>
              <span id="knowledge-content-label">Content</span>
              <div className={styles.viewSwitch} role="group" aria-label="Editor view">
                <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Write</button>
                <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
              </div>
            </div>
            {preview ? <div className={styles.editorPreview} role="region" aria-label="Markdown preview" tabIndex={0}>
              {content.trim() ? <ChatMarkdown content={content} className={styles.markdown} /> : <p className={styles.previewEmpty}>Write or upload some Markdown to see a preview.</p>}
            </div> : <textarea ref={contentRef} id="knowledge-content" aria-labelledby="knowledge-content-label" name="content" value={content} onChange={(event) => { setContent(event.target.value); setError(""); setFileError(""); setPasteHint(""); }} placeholder="Write or paste your coding standards, architecture decisions, and review guidelines here…" required rows={8} disabled={busy} spellCheck={false} />}
            {error && <p className={styles.error} role="alert">{error}</p>}
          </div>
          <div className={styles.dialogFooter}>
            <span>Markdown supported, up to 64 KB</span>
            <div><button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => mode === "edit" ? cancelEditing() : dialogRef.current?.close()}>Cancel</button><button type="submit" className={shared.primaryButton} disabled={busy || !title.trim() || !content.trim()}>{pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add document"}</button></div>
          </div>
        </form>
      </> : <>
        {detail && <div className={styles.readerToolbar}>
          <span>{saved === "Changes saved." ? <span role="status">Changes saved.</span> : `Added ${new Date(detail.createdAt).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "numeric" })}`}</span>
          <div className={styles.viewSwitch} role="group" aria-label="Document view">
            <button type="button" aria-pressed={preview} onClick={() => setPreview(true)}>Preview</button>
            <button type="button" aria-pressed={!preview} onClick={() => setPreview(false)}>Markdown</button>
          </div>
        </div>}
        <div className={styles.readerBody} role="region" aria-label="Document content" tabIndex={0} aria-busy={detailLoading}>
          {detailLoading && <p className={styles.loading} role="status">Loading document…</p>}
          {detail && (preview ? <ChatMarkdown content={detail.content} className={styles.markdown} /> : <pre className={styles.documentSource}>{detail.content}</pre>)}
        </div>
        {error && <p className={styles.error} role="alert">{error}</p>}
        {detail && canManage && <div className={styles.readerFooter}>
          {confirmDelete ? <>
            <p role="alert">Delete this document from the workspace? This can’t be undone.</p>
            <div><button type="button" className={shared.secondaryButton} disabled={busy} onClick={() => { setConfirmDelete(false); setError(""); }}>Cancel</button><button type="button" className={styles.deleteButton} disabled={busy} onClick={() => void deleteDocument()}>{pending ? "Deleting…" : "Delete document"}</button></div>
          </> : <>
            <button type="button" className={styles.deleteButton} disabled={busy} onClick={() => { setConfirmDelete(true); setError(""); }}><DashboardIcon name="trash" />Delete</button>
            <button type="button" className={shared.primaryButton} disabled={busy} onClick={startEditing}>Edit document</button>
          </>}
        </div>}
      </>}
    </dialog>
  </section>;
}
