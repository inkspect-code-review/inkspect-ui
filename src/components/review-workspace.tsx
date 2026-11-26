"use client";
import { ReviewPullTitle } from "./review-pull-title";

import { ConfirmationDialog } from "./confirmation-dialog";
import { Notification } from "./notification-toast";
import { useDashboardEdition, useDashboardWidgets } from "./dashboard-edition";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import Link from "next/link";
import { Dialog } from "radix-ui";
import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenPull, ReportResponse, ReviewJob, ReviewRepository } from "@inkspect/core/lib/review-types";
import { subscribeReviews, type LiveState } from "@inkspect/core/lib/review-realtime";
import { reviewAction } from "@inkspect/core/lib/review-action";
import { newestReviews, selectedReviewId, reviewsWithLinkedJob, summarizeOpenFindings } from "@inkspect/core/lib/review-history";
import { GitPullRequest, Plus, ArrowUpRight, X } from "lucide-react";
import { ReviewActivity } from "./review-activity";
import { ReviewCostView } from "./review-cost";
import { ReviewFix } from "./review-fix";
import { ReviewReportView } from "./review-report";
import styles from "./reviews.module.css";
import { SearchableSelect } from "./ui/searchable-select";
import { subscribeFindingStatusChanges } from "@inkspect/core/lib/finding-status-events";
import { Skeleton } from "./ui/skeleton";

const terminal = (status: string) => ["completed", "failed", "cancelled"].includes(status);
export function ReviewWorkspace({ organizationId, initialRepositories }: { organizationId: string; initialRepositories?: ReviewRepository[] }) {
  const { ReviewAllowance, ReviewUsage, ReviewRepositoryAction } = useDashboardWidgets();
  const edition = useDashboardEdition();
  const [repositories, setRepositories] = useState<ReviewRepository[]>(initialRepositories || []);
  const [historyRepositories, setHistoryRepositories] = useState<ReviewRepository[]>(initialRepositories || []);
  const [repository, setRepository] = useState(0);
  const [pulls, setPulls] = useState<OpenPull[]>([]);
  const [pullNumber, setPullNumber] = useState(0);
  const [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const [loadedRepository, setLoadedRepository] = useState(-1);
  const [reviews, setReviews] = useState<ReviewJob[]>([]), [selectedId, setSelectedId] = useState("");
  const [report, setReport] = useState<{ jobId: string; value: ReportResponse } | null>(null);
  const [findingStatusRevision, setFindingStatusRevision] = useState(0);
  useEffect(() => subscribeFindingStatusChanges(organizationId, () => setFindingStatusRevision(value => value + 1)), [organizationId]);
  const [retryJobId, setRetryJobId] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [composerRepository, setComposerRepository] = useState(initialRepositories?.[0]?.id || 0);
  const [repositoriesReady, setRepositoriesReady] = useState(false);
  const [historyWarning, setHistoryWarning] = useState("");
  const selected = loadedRepository === repository ? reviews.find(r => r.job.id === selectedId) : undefined;
  const currentRepository = historyRepositories.find(item => item.id === repository);
  const chooseRepository = !repository || !!currentRepository?.archived;
  const activeRepository = composing ? (chooseRepository ? composerRepository : repository) : Number(selected?.snapshot.repository_id) || repository;
  const [channel, setChannel] = useState(""), [live, setLive] = useState<LiveState>("connecting");
  const [configuration, setConfiguration] = useState<{ repository: number; mode: string; activity: boolean; credentialId: string; composerJobs?: ReviewJob[] } | null>(null);
  const mode = configuration?.repository === activeRepository ? configuration.mode : "";
  const activityAvailable = !!selected;
  const refreshJobs = useRef<(() => void) | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(initialRepositories === undefined), [pullsLoading, setPullsLoading] = useState(false), [pending, setPending] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const mutation = useRef(false), mounted = useRef(true);
  const linkInitialized = useRef(false), linkedJob = useRef<string | null>(null);
  const linkedReview = useRef<{ jobId: string; repositoryId: number } | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const request = useCallback(async (action: string, extra: Record<string, string> = {}, body?: object, signal?: AbortSignal) => {
    const query = new URLSearchParams({ organizationId, action, repositoryId: String(repository), ...extra });
    const response = await productFetch(`/api/reviews?${query}`, { method: body ? "POST" : "GET", cache: "no-store", headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}), signal });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Could not load reviews.");
    return result;
  }, [organizationId, repository]);
  const scopedRequest = useCallback((action: string, extra: Record<string, string> = {}, body?: object, signal?: AbortSignal) => request(action, { ...extra, repositoryId: String(activeRepository) }, body, signal), [request, activeRepository]);
  const detailRequest = useCallback((action: string, extra: Record<string, string> = {}, body?: object, signal?: AbortSignal) => request(action, { ...extra, repositoryId: selected?.snapshot.repository_id || String(repository) }, body, signal), [request, selected?.snapshot.repository_id, repository]);
  useEffect(() => {
    const controller = new AbortController();
    productFetch(`/api/reviews?${new URLSearchParams({ organizationId, action: "repositories" })}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const value = await response.json(); if (!response.ok) throw new Error(value.error || "Could not load repositories.");
      if (controller.signal.aborted) return;
      setRepositories(value.repositories);
      const historyCatalog: ReviewRepository[] = value.history_repositories ?? value.repositories;
      setHistoryRepositories(historyCatalog);
      setRepositoriesReady(true);
      setComposerRepository(current => value.repositories.some((repo: ReviewRepository) => repo.id === current) ? current : value.repositories[0]?.id || 0);
      const query = new URLSearchParams(window.location.search);
      const linkedRepository = Number(query.get("repositoryId"));
      if (!linkInitialized.current && historyCatalog.some(repo => repo.id === linkedRepository)) {
        setRepository(linkedRepository);
        const job = query.get("jobId") || "";
        linkedJob.current = /^J-[a-f0-9]{32}$/.test(job) ? job : null;
        linkedReview.current = linkedJob.current ? { jobId: linkedJob.current, repositoryId: linkedRepository } : null;
      } else setRepository(current => historyCatalog.some(repo => repo.id === current) ? current : 0);
      linkInitialized.current = true;
      setChannel(value.realtime_channel);
      if (value.unavailable_connections) setError(value.unavailable_accounts?.length ? `Some repositories from ${value.unavailable_accounts.join(", ")} couldn’t be loaded for reviews. Available repositories are shown below.` : "Some GitHub accounts couldn’t be loaded for reviews. Available repositories are shown below.");
    }).catch((error) => { reportBrowserError("browser.review.workspace", error); if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, refresh, initialRepositories]);
  useEffect(() => {
    if (!composing || !activeRepository) return;
    const controller = new AbortController();
    // Loading state also disables starting a snapshot from the previous page.
    Promise.resolve().then(() => { if (!controller.signal.aborted) { setPullsLoading(true); setPulls([]); setPullNumber(0); } });
    scopedRequest("pulls", { page: String(page) }, undefined, controller.signal).then((value) => { if (controller.signal.aborted) return; setPulls(value.pulls); setHasMore(value.has_more); setPullNumber(value.pulls.find((p: OpenPull) => !p.draft)?.number || 0); }).catch((error) => { reportBrowserError("browser.review.workspace", error); if (!controller.signal.aborted) setError(error.message); }).finally(() => { if (!controller.signal.aborted) setPullsLoading(false); });
    return () => controller.abort();
  }, [composing, activeRepository, page, scopedRequest, refresh]);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!composing || !activeRepository) return;
    const controller = new AbortController();
    Promise.all([
      scopedRequest("configuration", {}, undefined, controller.signal),
      currentRepository?.archived ? scopedRequest("jobs", {}, undefined, controller.signal) : undefined,
    ]).then(([value, history]) => {
      if (!controller.signal.aborted) { setConfiguration({ repository: activeRepository, mode: value.execution_mode, activity: value.activity_available === true, credentialId: value.byok_credential_id || "", composerJobs: history?.reviews }); }
    }).catch(error => { reportBrowserError("browser.review.configuration", error); if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [composing, activeRepository, scopedRequest, refresh, currentRepository?.archived]);
 const [activityRevision,setActivityRevision]=useState(0);
  useEffect(() => {
    if (!channel) return;
    let debounce: ReturnType<typeof setTimeout>;
    const dispose = subscribeReviews({ channel, organizationId, onState: setLive, onMessage: () => {}, onActivity: () => setActivityRevision((v)=>v+1), onRefresh: () => { clearTimeout(debounce); debounce = setTimeout(() => setRevision((v) => v + 1), 400); } });
    return () => { clearTimeout(debounce); dispose(); };
  }, [channel, organizationId]);
  useEffect(() => {
    if (!repositoriesReady) return;
    let controller: AbortController | undefined, timer: ReturnType<typeof setTimeout>;
    let stopped = false, busy = false, queued = false;
    const load = async () => {
      if (stopped) return;
      if (busy) { queued = true; return; }
      busy = true; clearTimeout(timer);
      controller = new AbortController();
      try {
        const value = await request(repository ? "jobs" : "history", {}, undefined, controller.signal);
        const linked = linkedReview.current && (!repository || repository === linkedReview.current.repositoryId) ? linkedReview.current : null;
        const sorted = await reviewsWithLinkedJob(value.reviews, linked, () => request("job", { jobId: linked!.jobId, repositoryId: String(linked!.repositoryId) }, undefined, controller!.signal));
        if (!stopped) {
          setHistoryWarning(value.unavailable_repositories ? `${value.unavailable_repositories} repositories could not be loaded. Showing available reviews.` : "");
          setLoadedRepository(repository); setReviews(sorted);
          const requested = linkedJob.current;
          setSelectedId(id => selectedReviewId(sorted, id, requested));
          if (requested && sorted.some(row => row.job.id === requested)) linkedJob.current = null;
        }
      } catch (error) { reportBrowserError("browser.review.workspace", error); if (!stopped && !controller.signal.aborted) setError((error as Error).message); }
      busy = false;
      if (!stopped) { timer = setTimeout(load, queued ? 1000 : 30_000); queued = false; }
    };
    refreshJobs.current = () => { void load(); };
    void load(); return () => { stopped = true; refreshJobs.current = null; clearTimeout(timer); controller?.abort(); };
  }, [request, repository, repositoriesReady]);
  useEffect(() => { refreshJobs.current?.(); }, [revision, findingStatusRevision]);
  useEffect(() => {
    const controller = new AbortController();
    Promise.resolve().then(() => { if (!controller.signal.aborted) setReport(current => current?.jobId === selected?.job.id ? current : null); });
    if (selected?.job.status === "completed") detailRequest("report", { jobId: selected.job.id }, undefined, controller.signal).then(value => { if (!controller.signal.aborted) setReport({ jobId: selected.job.id, value }); }).catch((error) => { reportBrowserError("browser.review.workspace", error); if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [selected?.job.id, selected?.job.status, detailRequest, findingStatusRevision, revision]);
  const pull = pulls.find((p) => p.number === pullNumber);
  // The composer leaves model selection to the server. Saved jobs contain the resolved model.
  const action = reviewAction(configuration?.composerJobs ?? reviews, pull, activeRepository, undefined, configuration?.credentialId || "");
  const historyReady = loadedRepository === repository && configuration?.repository === activeRepository && activeRepository > 0;
  async function start() {
    if (!pull || pull.draft || mutation.current || pullsLoading || !historyReady) return;
    if (action.kind === "view") { if (currentRepository?.archived) setRepository(activeRepository); setSelectedId(action.jobId); setComposing(false); return; }
    await submitReview(activeRepository, pull, action.kind === "retry" ? action.jobId : undefined);
  }
  async function submitReview(repositoryId: number, snapshot: Pick<OpenPull, "number" | "base_tip" | "head">, retryOf?: string) {
    if (mutation.current) return;
    mutation.current = true; setPending(true); setError("");
    try {
      const value: ReviewJob = await request("start", { repositoryId: String(repositoryId) }, { number: snapshot.number, base_tip: snapshot.base_tip, head: snapshot.head, ...(retryOf ? { retry_of: retryOf } : {}) });
      if (mounted.current) { if (currentRepository?.archived) setRepository(repositoryId); setReviews((rows) => newestReviews([value, ...rows.filter((r) => r.job.id !== value.job.id)])); setSelectedId(value.job.id); setComposing(false); setRevision((v) => v + 1); }
    } catch (error) { reportBrowserError("browser.review.workspace", error); if (mounted.current) setError((error as Error).message); }
    finally { mutation.current = false; if (mounted.current) setPending(false); }
  }
  async function cancel() {
    if (!selected || mutation.current) return;
    mutation.current = true; setPending(true);
    try { await detailRequest("cancel", { jobId: selected.job.id }, {}); if (mounted.current) setRevision((v) => v + 1); }
    catch (error) { reportBrowserError("browser.review.workspace", error); if (mounted.current) setError((error as Error).message); }
    finally { mutation.current = false; if (mounted.current) setPending(false); }
  }
  const selectedRepositoryConnected = !!selected && repositories.some(repo => String(repo.id) === selected.snapshot.repository_id);
  const composerTrigger = useRef<HTMLButtonElement | null>(null);
  const openComposer = (event: React.MouseEvent<HTMLButtonElement>) => {
    composerTrigger.current = event.currentTarget;
    setComposing(true);
  };
  const reviewLatest = async (jobId: string) => {
    if (!selected || mutation.current) return;
    mutation.current = true; setPending(true);
    try {
      const value: ReviewJob = await detailRequest("job", { jobId });
      if (!mounted.current) return;
      if (value.snapshot.repository_id !== selected.snapshot.repository_id || value.snapshot.url !== selected.snapshot.url) throw new Error("The latest review does not belong to this PR.");
      linkedReview.current = { jobId, repositoryId: Number(value.snapshot.repository_id) };
      setReviews(rows => newestReviews([value, ...rows.filter(row => row.job.id !== jobId)]));
      setSelectedId(jobId); setComposing(false);
    } catch (failure) { if (mounted.current) setError(failure instanceof Error ? failure.message : "Could not open the latest review."); }
    finally { mutation.current = false; if (mounted.current) setPending(false); }
  };
  const visibleReviews = loadedRepository === repository ? newestReviews(reviews) : [];
  const selectedPullNumber = Number(selected?.snapshot.url.match(/\/pull\/([1-9]\d*)\/?$/)?.[1]);
  const selectedPull = selected && pulls.find(item => item.url === selected.snapshot.url);
  const savedTitle = selected?.snapshot.title || selectedPull?.title;
  const pausedAhead = selected?.job.status === "queued" && reviews.find(row =>
    row.snapshot.repository_id === selected.snapshot.repository_id && row.job.status === "paused");
  const runDetails = selected ? <div className={styles.runDetails}>
    <details className={styles.disclosure} open><summary>Run details</summary><dl className={styles.metadata}><div><dt>Review ID</dt><dd>{selected.job.id}</dd></div><div><dt>Commit</dt><dd>{selected.snapshot.head}</dd></div>{selected.job.error_code && <div><dt>Error code</dt><dd>{selected.job.error_code}</dd></div>}</dl></details>
    {activityAvailable && <details key={selected.job.id} className={styles.disclosure} open><summary>Review activity</summary><ReviewActivity key={selected.job.id} jobId={selected.job.id} revision={revision + activityRevision} status={selected.job.status} request={detailRequest} /></details>}
    {terminal(selected.job.status) && (ReviewUsage
      ? <ReviewUsage key={`${organizationId}:${selected.job.id}`} organizationId={organizationId} jobId={selected.job.id} />
      : <ReviewCostView cost={selected.billing_usage?.provider_cost} />)}
  </div> : null;
  const actionRepository = ReviewRepositoryAction && repositories.find(repo => repo.id === (repository || Number(selected?.snapshot.repository_id)));
  const detailLoading = loading || !repositoriesReady || loadedRepository !== repository;
  return <section className={styles.workspace} aria-label="Reviews workspace">
    <aside className={styles.listPane} aria-label="Repositories and reviews">
      <div className={styles.listHeading}><h1>Reviews</h1><button className={styles.iconButton} aria-label="Start a new review" title="Start a new review" disabled={detailLoading || !repositories.length || pending} aria-haspopup="dialog" onClick={openComposer}><Plus size={17} /></button></div>
      <div className={styles.repositoryPicker}>
        <label htmlFor="review-repository">Repository</label>
        <SearchableSelect id="review-repository" label="Repository" value={String(repository)} disabled={loading || pending}
          placeholder={loading ? "Loading repositories…" : "Choose a repository"} searchPlaceholder="Search repositories…" emptyMessage="No matching repositories."
          options={[{ value: "0", label: "All repositories" }, ...historyRepositories.map(repo => ({ value: String(repo.id), label: `${repo.full_name}${repo.archived ? " (Disconnected)" : ""}` }))]}
          onValueChange={value => { if (Number(value) === repository) return; setRepository(Number(value)); setPage(1); setPulls([]); setPullNumber(0); setHasMore(false); setSelectedId(""); setLoadedRepository(-1); setReviews([]); setReport(null); setComposing(false); setError(""); }} />
      </div>
      <div className={styles.historyHeading}><h2>Review history</h2><span>Newest first</span></div>
      <Notification tone="info" message={historyWarning} />
      <nav className={styles.history} aria-label="Review history" aria-busy={!repositoriesReady || loadedRepository !== repository}>
        {!repositoriesReady || loadedRepository !== repository ? <p>Loading reviews…</p> : !visibleReviews.length ? <p>No reviews yet. Start with an open pull request.</p> : <ol>{visibleReviews.map((row, index) => {
          const summary = row.finding_summary;
          return <li key={row.job.id}>
          <button aria-current={row.job.id === selectedId ? "true" : undefined} data-findings-tone={summary?.open ? summary.urgent ? "danger" : "warning" : undefined} onClick={() => { setSelectedId(row.job.id); setComposing(false); }}>
            <span className={styles.historyTitle}><GitPullRequest size={15} /><strong>PR #{row.snapshot.url.split("/").at(-1)}</strong>{index === 0 && <small>Latest</small>}</span>
            <span className={styles.historySubtitle}>{!repository && <span className={styles.historyRepository}>{historyRepositories.find(repo => String(repo.id) === row.snapshot.repository_id)?.full_name || "Repository"}</span>}{pulls.find(item => item.url === row.snapshot.url)?.title || `Commit ${row.snapshot.head.slice(0, 7)}`}</span>
            <span className={styles.historyMeta}><span className={styles.status} data-status={row.job.status}>{row.job.status.replaceAll("_", " ")}</span><time dateTime={row.job.created_at} title={new Date(row.job.created_at).toLocaleString()}>{new Date(row.job.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })} {new Date(row.job.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time></span>
            {!!summary?.open && <span className={styles.historyFindings}>{summary.open} open {summary.open === 1 ? "finding" : "findings"}</span>}
          </button>
        </li>; })}</ol>}
      </nav>
      <footer className={styles.sidebarFooter}><span className={styles.live} data-live={live === "live"} role="status">{live === "live" ? "Live updates" : "Checking for updates"}</span><Link href="/dashboard?view=repositories">Manage repositories <ArrowUpRight size={13} /></Link></footer>
    </aside>
    <div className={styles.detailPane}>
      <header className={styles.workspaceHeader}><div className={styles.headerRepository}><span>{actionRepository?.full_name || currentRepository?.full_name || "All repositories"}</span>
        {ReviewRepositoryAction && actionRepository && <ReviewRepositoryAction key={actionRepository.id} repositoryId={actionRepository.id} repositoryName={actionRepository.full_name} />}
      </div>{!detailLoading && <button aria-haspopup="dialog" onClick={openComposer} disabled={!repositories.length || pending}><Plus size={14} />New review</button>}</header>
      <Notification tone="error" message={error} action={{ label: "Retry loading reviews", onClick: () => { setError(""); setRefresh(v => v + 1); setRevision(v => v + 1); } }} />
      {detailLoading ? !error && <ReviewSkeleton /> : <>
      <Dialog.Root open={composing} onOpenChange={open => { if (!pending) setComposing(open); }}>
        <Dialog.Portal><Dialog.Overlay className={styles.composerOverlay} />
        <Dialog.Content id="review-composer" className={styles.composer} aria-busy={pending} onCloseAutoFocus={event => {
          if (composerTrigger.current?.isConnected) { event.preventDefault(); composerTrigger.current.focus(); }
        }}>
        <div className={styles.toolbar}><div><Dialog.Title>Start a review</Dialog.Title><Dialog.Description>Choose a repository and an open pull request.</Dialog.Description></div><Dialog.Close className={styles.iconButton} aria-label="Close new review" disabled={pending}><X size={16} /></Dialog.Close></div>
        {chooseRepository && <div className={styles.composerRepository}><label htmlFor="new-review-repository">Repository for this review</label><SearchableSelect id="new-review-repository" label="Repository for this review" placeholder="Choose a repository" searchPlaceholder="Search repositories…" emptyMessage="No matching repositories." value={String(composerRepository)} disabled={pending} options={repositories.map(repo => ({ value: String(repo.id), label: repo.full_name }))} onValueChange={value => { setComposerRepository(Number(value)); setPage(1); setPulls([]); setPullNumber(0); }} /></div>}
        <div className={styles.selection} aria-busy={pullsLoading}>
          <div className={styles.selectionField}><label htmlFor="review-pull-request">Open pull request</label>
            <SearchableSelect id="review-pull-request" label="Open pull request" value={String(pullNumber)} disabled={!activeRepository || pending || pullsLoading}
              placeholder={pullsLoading ? "Loading pull requests…" : pulls.length ? "Choose a pull request" : "No open pull requests"}
              searchPlaceholder="Search by PR number or title…" emptyMessage={pulls.length ? "No matching pull requests on this page." : "No open pull requests on this page."}
              options={pulls.map(item => ({ value: String(item.number), label: `#${item.number} ${item.title}${item.draft ? " (draft)" : ""}`, disabled: item.draft }))}
              footer={(page > 1 || hasMore) ? `Searching page ${page}. Use the page controls to see other pull requests.` : undefined}
              onValueChange={value => setPullNumber(Number(value))} />
          </div>
          <button className={styles.primary} onClick={() => void start()} disabled={!pull || pull.draft || pending || pullsLoading || !historyReady}>{pending ? "Please wait…" : !historyReady ? "Loading reviews…" : action.label}</button>
        </div>
        {pull && <div className={styles.snapshot}><a href={pull.url} target="_blank" rel="noreferrer">View #{pull.number} on GitHub</a><span>Base <code title={pull.base_tip}>{pull.base_tip.slice(0, 7)}</code> → Head <code title={pull.head}>{pull.head.slice(0, 7)}</code></span></div>}
        {(page > 1 || hasMore) && <div className={styles.pagination}><button disabled={page === 1 || pullsLoading} onClick={() => setPage(v => v - 1)}>Previous PRs</button><span>Page {page}</span><button disabled={!hasMore || pullsLoading} onClick={() => setPage(v => v + 1)}>More PRs</button></div>}
        {composing && ReviewAllowance && <ReviewAllowance key={`${organizationId}:${repository}:${revision}`} organizationId={organizationId} />}
      {mode === "codex-development" && <p className={styles.notice}>Local Codex development mode. Live token caps and monetary cost are not enforced or measured.</p>}
        </Dialog.Content></Dialog.Portal>
      </Dialog.Root>
      <div className={styles.detail}>
        {!selected ? <div className={styles.empty}><GitPullRequest size={28} /><h2>Your next review starts here</h2><p>{repositories.length ? "Choose a review from the sidebar, or review an open pull request." : "Connect a repository to start reviewing pull requests."}</p>{repositories.length ? <button className={styles.primary} aria-haspopup="dialog" onClick={openComposer}>Start a review</button> : <Link href="/dashboard?view=integrations">Connect GitHub</Link>}</div> : <>
          <header className={styles.jobHeading}><div><div className={styles.jobTitle}><h2><ReviewPullTitle title={savedTitle} organizationId={selectedRepositoryConnected ? organizationId : undefined} repositoryId={selected.snapshot.repository_id} number={selected.snapshot.url.match(/\/pull\/([1-9]\d*)$/)?.[1]} fallback={`Pull request #${selected.snapshot.url.split("/").at(-1)}`} /></h2><span className={styles.status} data-status={selected.job.status}>{selected.job.status.replaceAll("_", " ")}</span></div><div className={styles.jobMeta}><a href={selected.snapshot.url} target="_blank" rel="noreferrer">PR #{selected.snapshot.url.split("/").at(-1)} <ArrowUpRight size={12} /></a><time dateTime={selected.job.created_at}>{new Date(selected.job.created_at).toLocaleString()}</time><code title={selected.snapshot.head}>{selected.snapshot.head.slice(0, 7)}</code></div></div>{!terminal(selected.job.status) && <button disabled={pending || selected.job.cancel_requested} onClick={cancel}>{selected.job.cancel_requested ? "Cancelling…" : "Cancel review"}</button>}</header>
          {!selectedRepositoryConnected && <p className={styles.notice}>This repository is no longer connected. Your saved review is available to read.</p>}
          {selected.job.status === "completed" ? report?.jobId === selected.job.id ? <ReviewReportView key={selected.job.id} organizationId={organizationId} value={report.value} details={runDetails} fix={selectedRepositoryConnected ? <ReviewFix key={selected.job.id} openFindingCount={selected.finding_summary?.open ?? summarizeOpenFindings(report.value.report.findings, report.value.finding_statuses).open} jobId={selected.job.id} pullUrl={selected.snapshot.url} request={detailRequest} onReviewLatest={reviewLatest} /> : undefined} /> : <ReviewSkeleton heading={false} /> : <div className={styles.runState}><h3>{selected.job.status === "failed" ? "Review could not finish" : selected.job.status === "cancelled" ? "Review cancelled" : selected.job.status === "paused" ? "Review paused" : selected.job.status === "running" ? "Review in progress" : "Review queued"}</h3><p>{selected.job.status === "paused" ? edition.reviewPausedMessage : pausedAhead ? `Waiting for the paused review of PR #${pausedAhead.snapshot.url.split("/").at(-1)} to resume.` : selected.job.status === "queued" ? "Waiting for a review worker to start." : terminal(selected.job.status) ? "Start a new review of this pull request when you’re ready to try again." : "You can leave this page. The review continues in the background."}</p><Notification tone="error" message={selected.error_message} notificationKey={selected.job.id} />
            {terminal(selected.job.status) && selectedRepositoryConnected && Number.isSafeInteger(selectedPullNumber) && (
              <ConfirmationDialog key={selected.job.id} open={retryJobId === selected.job.id} onOpenChange={open => setRetryJobId(open ? selected.job.id : null)}
                title={`Retry review for PR #${selectedPullNumber}?`} confirmLabel="Start review" busy={pending}
                description={`This will start a new review at commit ${selected.snapshot.head.slice(0, 7)}.`}
                trigger={<button type="button" disabled={pending}>Retry review</button>}
                onConfirm={async () => {
                  if (retryJobId !== selected.job.id || mutation.current) return;
                  await submitReview(Number(selected.snapshot.repository_id), { number: selectedPullNumber, base_tip: selected.snapshot.base_tip, head: selected.snapshot.head }, selected.job.id);
                  if (mounted.current) setRetryJobId(null);
                }} />
            )}</div>}
          {selected.job.status !== "completed" && runDetails}
        </>}
      </div>
      </>}
    </div>
  </section>;
}

function ReviewSkeleton({ heading = true }: { heading?: boolean }) {
  return <div className={styles.reviewSkeleton} role="status" aria-label="Loading review details" aria-busy="true">
    <div aria-hidden="true">
      {heading && <div className={styles.skeletonHeading}><Skeleton className={styles.skeletonTitle} /><Skeleton className={styles.skeletonMeta} /></div>}
      <div className={styles.skeletonSection}><Skeleton className={styles.skeletonLabel} /><Skeleton /><Skeleton /><Skeleton className={styles.skeletonShort} /></div>
      <div className={styles.scoreGrid}>{[0, 1].map(index => <div key={index} className={styles.skeletonScore}><Skeleton className={styles.skeletonLabel} /><Skeleton /><Skeleton className={styles.skeletonShort} /></div>)}</div>
      <div className={styles.skeletonSection}><Skeleton className={styles.skeletonLabel} />{[0, 1].map(index => <div key={index} className={styles.skeletonFinding}><Skeleton className={styles.skeletonShort} /><Skeleton /><Skeleton /></div>)}</div>
    </div>
  </div>;
}
