"use client";

import { Notification } from "./notification-toast";
import { useDashboardEdition, useDashboardWidgets } from "./dashboard-edition";
import { productFetch } from "@inkspect/core/lib/api-client";

import Link from "next/link";
import { CircleCheck, Settings2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { RepositoryEmptyState } from "./repository-empty-state";
import { useEffect, useRef, useState } from "react";
import type { Repository } from "@inkspect/core/lib/github";
import type { RepositoryIndex, RepositoryIndexEligibility, RepositoryIndexFreshness } from "@inkspect/core/lib/repository-types";
import { hasFileCounts, indexLogKey, mergeRepositoryIndex } from "@inkspect/core/lib/repository-activity";
import { subscribeReviews, type LiveState } from "@inkspect/core/lib/review-realtime";
import { DashboardIcon } from "./dashboard-icon";
import { matchingRepositories, readIndexedIds, repositoryPage, starredRepositories } from "./repository-browser-filters";
import shared from "./dashboard.module.css";
import styles from "./repositories-workspace.module.css";

const endpoint = (organizationId: string, action: string, repository?: number) => `/api/repositories?${new URLSearchParams({ organizationId, action, ...(repository ? { repository: String(repository) } : {}) })}`;
async function result(response: Response) {
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Could not load the repository. Try again.");
  return value;
}
function Star({ filled }: { filled: boolean }) {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m12 3 2.8 5.7 6.3.9-4.5 4.4 1.1 6.2-5.7-3-5.7 3 1.1-6.2L3.2 9.6l6.3-.9Z" /></svg>;
}
export function RepositoriesWorkspace({ organizationId, repositories, canManage }: { organizationId: string; repositories: Repository[]; canManage: boolean }) {
  const { repositoryBadge } = useDashboardWidgets();
  const searchParams = useSearchParams();
  const [availableRepositories, setAvailableRepositories] = useState(repositories);
  useEffect(() => { const controller = new AbortController(); productFetch(endpoint(organizationId, "list"), { signal: controller.signal, cache: "no-store" }).then(result).then(value => { if (!controller.signal.aborted) setAvailableRepositories(value.repositories); }).catch(() => {}); return () => controller.abort(); }, [organizationId, repositories]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const repositoryList = useRef<HTMLUListElement>(null);
  const [onlyStars, setOnlyStars] = useState(false);
  const [onlyIndexed, setOnlyIndexed] = useState(false);
  const selected = availableRepositories.find(repo => String(repo.id) === searchParams.get("repositoryId"))?.id ?? availableRepositories[0]?.id;
  const [stars, setStars] = useState<number[]>([]);
  const [pending, setPending] = useState<number[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [toastError, setToastError] = useState("");
  const [starAttempt, setStarAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    productFetch(endpoint(organizationId, "stars"), { signal: controller.signal, cache: "no-store" }).then(result).then(value => { setStars(value.stars); setReady(true); setError(""); }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [organizationId, starAttempt]);
  async function toggleStar(id: number) {
    const starred = !stars.includes(id);
    setPending(current => [...current, id]); setError("");
    try {
      await productFetch(endpoint(organizationId, "star", id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ starred }) }).then(result);
      setStars(current => starred ? [...current.filter(value => value !== id), id] : current.filter(value => value !== id));
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your star."); }
    finally { setPending(current => current.filter(value => value !== id)); }
  }
  const starIds = new Set(stars);
  const matches = matchingRepositories(availableRepositories, query, starIds);
  const matchingStars = starredRepositories(matches, starIds);
  const candidates = onlyStars ? matchingStars : matches;
  // An index filter must consider matches on every page. Otherwise only visible badges need refreshing.
  const requestedIds = (onlyIndexed ? matches : repositoryPage(candidates, page).pageRepositories).map(repo => repo.id).sort((a, b) => a - b).join(",");
  const [snapshot, setSnapshot] = useState<{ scope: string; indexed: Set<number> } | null>(null);
  const [failedScope, setFailedScope] = useState<string | null>(null);
  const [coverageAttempt, setCoverageAttempt] = useState(0);
  useEffect(() => {
    if (!requestedIds) return;
    const controller = new AbortController();
    let fetching = false;
    async function refreshCoverage() {
      if (fetching || document.hidden) return;
      fetching = true;
      try {
        const indexed = await readIndexedIds(requestedIds.split(","), async batch => {
          const response = await productFetch(`${endpoint(organizationId, "index-coverage")}&ids=${batch.join(",")}`, {
            signal: controller.signal, cache: "no-store",
          }).then(result);
          return response.coverage;
        }, controller.signal);
        if (!controller.signal.aborted) {
          setSnapshot({ scope: requestedIds, indexed });
          setFailedScope(null);
        }
      } catch {
        if (!controller.signal.aborted) setFailedScope(requestedIds);
      } finally { fetching = false; }
    }
    void refreshCoverage();
    const timer = setInterval(refreshCoverage, onlyIndexed && matches.length > 20 ? 60000 : 15000);
    document.addEventListener("visibilitychange", refreshCoverage);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener("visibilitychange", refreshCoverage); };
  }, [organizationId, requestedIds, onlyIndexed, matches.length, coverageAttempt]);

  const awaitingIndex = onlyIndexed && !!requestedIds && snapshot?.scope !== requestedIds;
  const coverageError = onlyIndexed && failedScope === requestedIds;
  const indexed = snapshot?.indexed;
  const visible = onlyIndexed ? (awaitingIndex ? [] : candidates.filter(repo => indexed?.has(repo.id))) : candidates;
  const starCount = onlyIndexed ? matchingStars.filter(repo => indexed?.has(repo.id)).length : matchingStars.length;
  const { pages, currentPage, pageStart, pageRepositories } = repositoryPage(visible, page);
  const repo = availableRepositories.find(repo => repo.id === selected);
  function changePage(next: number) { setPage(next); if (repositoryList.current) repositoryList.current.scrollTop = 0; }
  return <div className={styles.workspace}>
    <aside className={styles.listPane} aria-label="Repository browser">
      <div className={styles.listHeading}><h1>Repositories</h1><span>{availableRepositories.length}</span></div>
      <div className={styles.filters}>
        <label className={styles.search}><DashboardIcon name="search" /><input aria-label="Search repositories" placeholder="Search repositories…" value={query} onChange={event => { setQuery(event.target.value); changePage(1); }} /></label>
        <div className={styles.filterActions}>
          <div className={styles.filterButtons} role="group" aria-label="Repository filters">
            <button type="button" className={styles.filterButton} aria-pressed={onlyStars} onClick={() => { setOnlyStars(value => !value); changePage(1); }}>
              <Star filled={onlyStars} />Starred<span>{ready && !awaitingIndex ? starCount : "…"}</span>
            </button>
            <button type="button" className={styles.filterButton} aria-pressed={onlyIndexed} onClick={() => { setOnlyIndexed(value => !value); changePage(1); }}>
              <CircleCheck size={15} aria-hidden="true" />Indexed
            </button>
          </div>
          {canManage && <Link className={styles.manage} href="/dashboard?view=integrations" aria-label="Manage integrations" title="Manage integrations"><Settings2 size={16} aria-hidden="true" /></Link>}
        </div>
      </div>
      <Notification tone="error" message={error} notificationKey={starAttempt} action={!ready ? { label: "Retry loading repositories", onClick: () => setStarAttempt(value => value + 1) } : undefined} />
      <Notification tone="error" message={coverageError ? "Repository index status could not be refreshed." : ""} notificationKey={coverageAttempt} action={{ label: "Retry", onClick: () => setCoverageAttempt(value => value + 1) }} />
      <ul aria-busy={awaitingIndex && !coverageError} ref={repositoryList} className={styles.repositoryList}>
        {pageRepositories.map(repo => <li key={repo.id} data-selected={selected === repo.id}>
          <Link className={styles.selectRepo} aria-current={selected === repo.id ? "true" : undefined} href={`/dashboard?${new URLSearchParams({ ...Object.fromEntries(searchParams), view: "repositories", repositoryId: String(repo.id) })}`} scroll={false}>
            {indexed?.has(repo.id) ? <CircleCheck className={styles.indexed} aria-hidden="true" /> : <DashboardIcon name="repositories" />}
            <span><strong>{repo.fullName.split("/").slice(1).join("/") || repo.fullName}</strong>
              <small className={styles.repoMeta}><span className={styles.owner} title={repo.fullName}>{repo.fullName.split("/")[0]}</span><span aria-hidden="true">/</span>{repo.private ? "Private" : "Public"}
                {repositoryBadge?.(repo.id)}
                {indexed?.has(repo.id) && <span className={styles.indexed}>Indexed</span>}
              </small>
            </span>
          </Link>
          <button className={styles.star} aria-label={`${stars.includes(repo.id) ? "Unstar" : "Star"} ${repo.fullName}`} aria-pressed={stars.includes(repo.id)} disabled={!ready || pending.includes(repo.id)} onClick={() => void toggleStar(repo.id)}><Star filled={stars.includes(repo.id)} /></button>
        </li>)}
      </ul>
      {!visible.length && <p className={styles.noResults} role="status">{awaitingIndex ? coverageError ? "Index status unavailable." : "Checking repository indexes…" : onlyStars && !ready ? "Loading starred repositories…" : onlyStars && onlyIndexed ? "No starred, indexed repositories match." : onlyIndexed ? "No indexed repositories match." : onlyStars ? "No starred repositories match." : "No repositories match your search."}</p>}
      <nav className={styles.pagination} aria-label="Repository pages"><span aria-live="polite">{awaitingIndex ? "…" : visible.length ? `${pageStart + 1}–${pageStart + pageRepositories.length} of ${visible.length}` : "0 repositories"}</span><div><button aria-label="Previous repository page" disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>‹</button><span>{currentPage} / {pages}</span><button aria-label="Next repository page" disabled={currentPage === pages} onClick={() => changePage(currentPage + 1)}>›</button></div></nav>
    </aside>
    {repo ? <RepositoryDetail key={`${organizationId}:${repo.id}`} organizationId={organizationId} repository={repo} onError={setToastError} /> : <div className={styles.emptyDetail}>Select a repository to see its details.</div>}
    <Notification tone="error" message={toastError} />
  </div>;
}
function RepositoryDetail({ organizationId, repository, onError }: { organizationId: string; repository: Repository; onError: (message: string) => void }) {
  const { PublicRepositoryNotice, ReviewRepositoryAction, repositoryBadge } = useDashboardWidgets();
  const supportAvailable = useDashboardEdition().sections.some(item => item.id === "support");
  const [index, setIndex] = useState<RepositoryIndex | null>(null);
  const [eligibility, setEligibility] = useState<RepositoryIndexEligibility | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [freshness, setFreshness] = useState<(RepositoryIndexFreshness & { scheduled_at?: string }) | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [live, setLive] = useState<LiveState>("connecting");
  const [retry, setRetry] = useState(0);
  const posting = useRef(false);
  const version = useRef(0);
  const mounted = useRef(true);
  const terminal = useRef<HTMLDivElement>(null);
  const followLogs = useRef(true);
  const requestId = useRef<{ id: string; action: "index" | "analyze" } | null>(null);
  useEffect(() => {
    mounted.current = true;
    const controller = new AbortController(); let fetching = false; let unsubscribe: (() => void) | undefined;
    async function refresh() {
      if (fetching || posting.current || controller.signal.aborted) return;
      fetching = true; const sequence = ++version.current;
      try {
        const value = await productFetch(endpoint(organizationId, "detail", repository.id), { signal: controller.signal, cache: "no-store" }).then(result);
        if (controller.signal.aborted || sequence !== version.current) return;
        setIndex(previous => mergeRepositoryIndex(previous, value.index)); setEligibility(value.eligibility ?? null); setFreshness(value.freshness ?? null); setLoaded(true); setError("");
        if (!unsubscribe && value.realtime_channel) unsubscribe = subscribeReviews({ channel: value.realtime_channel, organizationId, onRefresh: () => void refresh(), onIndex: () => void refresh(), onState: setLive, onMessage: () => {} });
      } catch (error) { if (!controller.signal.aborted && sequence === version.current) setError(error instanceof Error ? error.message : "Could not refresh the index."); }
      finally { fetching = false; }
    }
    void refresh(); const timer = setInterval(() => void refresh(), 5000);
    return () => { mounted.current = false; controller.abort(); clearInterval(timer); unsubscribe?.(); };
  }, [organizationId, repository.id, retry]);
  const p = index?.progress;
  const fileCountsKnown = !!p && hasFileCounts(p);
  const logs = p?.logs ?? [];
  useEffect(() => { if (terminal.current && followLogs.current) terminal.current.scrollTop = terminal.current.scrollHeight; }, [index?.updated_at]);
  const active = index?.status === "queued" || index?.status === "running";
  async function start(action: "index" | "analyze" = "index") {
    if (posting.current) return;
    posting.current = true; ++version.current; setPending(true); setError("");
    if (requestId.current?.action !== action) requestId.current = { id: crypto.randomUUID(), action };
    try {
      const value = await productFetch(endpoint(organizationId, action, repository.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: requestId.current.id }) }).then(result);
      if (!mounted.current) return;
      setIndex(previous => mergeRepositoryIndex(previous, value.index)); setFreshness(value.freshness ?? null); requestId.current = null; followLogs.current = true; onError("");
    } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : "Could not confirm the request. Retry to check its status."); }
    finally { posting.current = false; if (mounted.current) setPending(false); }
  }
  async function stop() {
    if (!index || posting.current) return;
    posting.current = true; ++version.current; setPending(true);
    try {
      const value = await productFetch(endpoint(organizationId, "cancel", repository.id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ requestId: index.id }) }).then(result);
      if (mounted.current) { setIndex(previous => mergeRepositoryIndex(previous, value.index)); onError(""); }
    } catch (error) { if (mounted.current) onError(error instanceof Error ? error.message : "Could not stop the operation. Try again."); }
    finally { posting.current = false; if (mounted.current) setPending(false); }
  }
  const githubURL = `https://github.com/${repository.fullName.split("/").map(encodeURIComponent).join("/")}`;
  const stage = p?.stage || "idle";
  const empty = stage === "empty";
  const scanning = stage === "reading" || stage === "discovering";
  const max = scanning ? p?.scan.total || 0 : p?.chunks || 0;
  const value = scanning ? p?.scan.processed || 0 : (p?.embedded || 0) + (p?.reused || 0);
  const partial = !!p?.indexed && (!!p.partial || (p.skipped ?? p.scan.skipped) > 0);
  const supportRequired = !!eligibility?.support_required || !!p?.support_required;
  const supportHref = `/dashboard?${new URLSearchParams({ view: "support", reason: "repository-size", repository: String(repository.id) })}`;
  const stages: Record<string, string> = { queued: "Waiting to start", resolving: "Preparing repository", discovering: "Scanning repository", cloning: "Cloning repository", reading: "Reading files", indexing: "Indexing repository", embedding: "Indexing repository", publishing: "Saving repository index", analyzing: "Writing description", summarizing: "Writing description", completed: "Indexed", empty: "Repository is empty", failed: p?.indexed ? "Indexed · analysis needs attention" : "Index needs attention", cancelled: "Indexing stopped", idle: "Ready to index" };
  return <section className={styles.detail} aria-label={`${repository.fullName} details`}>
    <header className={styles.detailHeader}><div><span className={styles.repoOwner}>{repository.fullName.split("/")[0]}</span><h2>{repository.fullName.split("/").slice(1).join("/") || repository.fullName}</h2><div className={styles.meta}><span><DashboardIcon name={repository.private ? "lock" : "repositories"} />{repository.private ? "Private" : "Public"}</span>{repositoryBadge?.(repository.id)}{p?.branch && <span>{p.branch}</span>}{p?.revision && <code title={p.revision}>{p.revision.slice(0, 7)}</code>}</div></div>
      <div className={styles.detailActions}>
        {ReviewRepositoryAction && <ReviewRepositoryAction repositoryId={repository.id} repositoryName={repository.fullName} />}
        <a className={shared.secondaryButton} href={githubURL} target="_blank" rel="noreferrer">View on GitHub<DashboardIcon name="arrow" /></a>
      </div>
    </header>
    {!repository.private && PublicRepositoryNotice && <PublicRepositoryNotice repositoryId={String(repository.id)} />}
    <div className={styles.indexAction}><div><h3>Repository context</h3><p>{empty ? "There are no commits to index yet." : p?.indexed && !active && freshness?.scheduled_at && !freshness.check_failed ? `Index is stale. Automatic refresh is scheduled for ${new Date(freshness.scheduled_at).toLocaleString()}. You can reindex now.` : p?.indexed ? "Your indexed code is available to Ask AI." : "Index your code to understand this repository and ask questions about it."}</p></div><div className={styles.indexButtons}>{active && <button className={`${shared.secondaryButton} ${styles.stopButton}`} disabled={pending} onClick={() => void stop()}>Stop</button>}{!active && supportRequired && supportAvailable ? <Link className={shared.primaryButton} href={supportHref}>Contact support<DashboardIcon name="arrow" /></Link> : <button className={shared.primaryButton} disabled={!loaded || active || pending || freshness?.up_to_date || !eligibility?.allowed} onClick={() => void start()}><DashboardIcon name={active ? "history" : "plus"} />{pending ? "Starting…" : active ? (p?.analyze_only ? "Analyzing…" : "Indexing…") : freshness?.up_to_date ? "Index up to date" : p?.indexed ? "Reindex repository" : "Index repository"}</button>}</div></div>
    {loaded && !active && eligibility && !eligibility.allowed && <p className={styles.eligibilityNotice}>{supportRequired ? `${eligibility.size_bytes != null ? `${(eligibility.size_bytes / 1024 / 1024).toLocaleString(undefined, { maximumFractionDigits: 1 })} MB reported by GitHub. ` : ""}Repositories over ${(eligibility.limit_bytes / 1024 / 1024).toLocaleString()} MB require ${supportAvailable ? "support" : "administrator"} assistance. No clone will be downloaded.` : eligibility.reason || "Repository size could not be verified. Refresh to try again."}</p>}
    <Notification tone="error" message={error} notificationKey={retry} action={!loaded ? { label: "Retry loading repository", onClick: () => setRetry(value => value + 1) } : undefined} />
    {!loaded && !error && <p className={styles.loading}>Loading repository details…</p>}
    {index && <div className={styles.indexStatus}>
      <div className={styles.statusHeading}><strong aria-live="polite">{stages[stage] || stage}</strong><span className={styles.live} data-live={live === "live"}><i />{live === "live" ? "Live" : "Refreshing every 5s"}</span></div>
      <div className={styles.counters}><span><strong>{fileCountsKnown ? p?.scan.read : "…"}</strong> files read</span><span><strong>{fileCountsKnown ? p?.scan.total : "…"}</strong> files found</span><span><strong>{p?.chunks || 0}</strong> chunks</span>{fileCountsKnown && !!p?.scan.skipped && <span><strong>{p.scan.skipped}</strong> skipped</span>}</div>
      {p?.indexed && !fileCountsKnown && <p className={styles.loading}>Refreshing file counts for the saved index…</p>}
      {partial && <details className={styles.skippedFiles}>
        <summary>Skipped files{(p?.skipped ?? p?.scan.skipped ?? 0) > 0 && ` (${p?.skipped ?? p?.scan.skipped})`}</summary>
        <p>Questions and reviews use the files included in the index.</p>
        {!!p?.omissions?.length && <ul>{p.omissions.map((item, i) => <li key={`${i}:${item.path}`}><code>{item.path}</code><span>{({ excluded_type_or_path: "Unsupported type or excluded path", binary: "Binary content", credential_pattern: "Credential detected", line_size_limit: "Line exceeds readable chunk size" } as Record<string, string>)[item.reason] || "Excluded from indexing"}</span></li>)}</ul>}
      </details>}
      {active && <div className={styles.progress}><progress aria-label={scanning ? "Files processed" : "Chunks indexed"} max={Math.max(max, 1)} {...(["resolving", "cloning", "discovering", "queued", "publishing", "summarizing", "analyzing"].includes(stage) ? {} : { value: Math.min(value, max) })} /><span>{stage === "summarizing" || stage === "analyzing" ? "Index saved. Generating description…" : stage === "publishing" ? "Saving repository index…" : stage === "resolving" ? "Checking repository access and revision…" : stage === "cloning" ? "Downloading a temporary clone…" : stage === "discovering" ? "Counting repository files…" : stage === "queued" ? "Queued" : `${value.toLocaleString()} / ${max.toLocaleString()} ${scanning ? "files processed" : "chunks indexed"}`}</span></div>}
      <div className={styles.terminal} ref={terminal} role="log" aria-label="Indexing activity" aria-live="off" tabIndex={0} onScroll={() => { const el = terminal.current; if (el) followLogs.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}><div className={styles.terminalTitle}><span>Index activity</span><span>{index.id.slice(0, 8)}</span></div>{logs.map(log => <div className={styles.logLine} key={`${index.id}:${indexLogKey(log)}`}><time dateTime={log.at}>{log.at.slice(11, 19)}</time><span>{log.message}</span></div>)}{active && <span className={styles.cursor} aria-hidden="true">▍</span>}</div>
      <Notification tone="error" message={p?.error} />
    </div>}
    {empty && !active ? <RepositoryEmptyState /> : p?.summary ? <article className={styles.description}><h3>About this repository</h3><p className={styles.purpose}>{p.summary.purpose}</p>{p.summary.technologies?.length > 0 && <ul className={styles.technologies} aria-label="Technologies">{p.summary.technologies.map((tech, i) => <li key={`${i}:${tech}`}>{tech}</li>)}</ul>}{p.summary.architecture?.length > 0 && <><h4>How it fits together</h4><ul className={styles.architecture}>{p.summary.architecture.map((item, i) => <li key={i}>{item}</li>)}</ul></>}{p.summary.evidence?.length > 0 && <details className={styles.evidence}><summary>Source files ({p.summary.evidence.length})</summary>{p.summary.evidence.map(path => <a key={path} href={`${githubURL}/blob/${p.revision}/${path.split("/").map(encodeURIComponent).join("/")}`} target="_blank" rel="noreferrer">{path}<DashboardIcon name="arrow" /></a>)}</details>}<footer>{p.summary.sampled ? "Based on a sample of the indexed code." : "Based on the indexed code."} Generated {new Date(index!.updated_at).toISOString().slice(0, 10)}.</footer></article> : !active && loaded && <div className={styles.descriptionEmpty}><DashboardIcon name="repositories" /><h3>A closer look at your code.</h3><p>{p?.indexed ? "Your index is ready. Analyze it to see what this repository does." : "Index this repository to see what it does, its main components, and the technologies it uses."}</p>{p?.indexed && <button className={shared.primaryButton} disabled={pending} onClick={() => void start("analyze")}>{pending ? "Starting…" : "Analyze"}</button>}</div>}
  </section>;
}
