"use client";

import { Notification } from "./notification-toast";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowUpRight, GitPullRequest, FolderGit2, RefreshCw, Search } from "lucide-react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import type { FindingsOrder, FindingsResponse } from "@inkspect/core/lib/findings";
import type { ReviewRepository } from "@inkspect/core/lib/review-types";
import { FindingsDateFilter } from "./findings-date-filter";
import { reviewDateBounds, type FindingsPeriod } from "./findings-date-range";
import { SearchableSelect } from "./ui/searchable-select";
import { RepositoryConnectionCard } from "./repository-connection-card";
import styles from "./findings.module.css";
import { FindingStatusControl } from "./finding-status-control";
import { subscribeFindingStatusChanges } from "@inkspect/core/lib/finding-status-events";

export function FindingsPanel({ organizationId, workspaceName, canManage, connected, repositories }: { organizationId: string; workspaceName: string; canManage: boolean; connected: boolean; repositories: ReviewRepository[] }) {
  const [repositoryId, setRepositoryId] = useState("0");
  const [severity, setSeverity] = useState("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<FindingsPeriod>("all");
  const { from, before } = reviewDateBounds(period);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<FindingsOrder>({ sort: "date", direction: "desc" });
  const [catalog, setCatalog] = useState<{ status: "loading" | "ready" | "error"; repositories: ReviewRepository[] }>({ status: "loading", repositories });
  const repositoryRevision = JSON.stringify(repositories);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    productFetch(`/api/reviews?${new URLSearchParams({ organizationId, action: "repositories" })}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load review repositories.");
      if (!controller.signal.aborted) setCatalog({ status: "ready", repositories: value.history_repositories ?? value.repositories });
    }).catch(error => {
      if (controller.signal.aborted) return;
      reportBrowserError("browser.findings.repositories", error);
      setCatalog(current => ({ ...current, status: "error" }));
    });
    return () => controller.abort();
  }, [organizationId, connected, repositoryRevision]);
  const toggleSort = (sort: FindingsOrder["sort"]) => setOrder(current => ({ sort, direction: current.sort === sort && current.direction === "desc" ? "asc" : "desc" }));
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const hasFilters = repositoryId !== "0" || severity !== "all" || status !== "all" || !!query || period !== "all";
  if (!connected || (catalog.status === "ready" && !catalog.repositories.length)) return <RepositoryConnectionCard section="findings" workspaceName={workspaceName} canManage={canManage} />;
  if (!catalog.repositories.length) return catalog.status === "error" ? <Notification tone="error" message="Your review repositories couldn’t be loaded. Refresh the page to try again." action={{ label: "Refresh page", onClick: () => window.location.reload() }} /> : <p className={styles.empty} role="status">Loading review repositories…</p>;
  return <div className={styles.workspace}>
    <div className={styles.filters} role="search" aria-label="Filter findings">
      <div className={styles.searchRow}>
        <div className={styles.field}>
          <label htmlFor="findings-search">Search findings</label>
          <div className={styles.searchInput}><Search size={16} aria-hidden="true" /><input data-slot="search-input" id="findings-search" type="search" maxLength={300} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by title or file name…" /></div>
        </div>
        <FindingsDateFilter period={period} onChange={setPeriod} />
      </div>
      <div className={styles.filterRow}>
        <div className={styles.field}>
          <label htmlFor="findings-repository">Repository</label>
          <SearchableSelect id="findings-repository" label="Repository" value={repositoryId} onValueChange={setRepositoryId}
            options={[{ value: "0", label: "All repositories" }, ...catalog.repositories.map(repository => ({ value: String(repository.id), label: `${repository.full_name}${repository.archived ? " (Disconnected)" : ""}` }))]}
            placeholder="All repositories" searchPlaceholder="Search repositories…" emptyMessage="No repositories found." />
        </div>
        <div className={styles.field}>
          <label htmlFor="findings-severity">Severity</label>
          <SearchableSelect id="findings-severity" label="Severity" value={severity} onValueChange={setSeverity}
            options={[{ value: "all", label: "All severities" }, { value: "critical", label: "Critical (P0)" }, { value: "high", label: "High (P1)" }, { value: "medium", label: "Medium (P2)" }, { value: "low", label: "Low (P3)" }]}
            placeholder="All severities" searchPlaceholder="Search severities…" emptyMessage="No severities found." />
        </div>
        <div className={styles.field}>
          <label htmlFor="findings-status">Status</label>
          <SearchableSelect id="findings-status" label="Status" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All history" }, { value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "not_detected", label: "Not detected in latest review" }, { value: "historical", label: "Earlier reviews" }]} placeholder="All history" searchPlaceholder="Search status…" emptyMessage="No matching status." />
        </div>
        <button className={styles.reset} type="button" disabled={!hasFilters} onClick={() => {
          setRepositoryId("0"); setSeverity("all"); setStatus("all"); setQuery(""); setSearch(""); setPeriod("all");
        }}>Clear filters</button>
      </div>
    </div>
    <FindingsList key={JSON.stringify([repositoryId, severity, status, search, from, before, order])} organizationId={organizationId} repositoryId={repositoryId} severity={severity} status={status} query={search} from={from} before={before} order={order} onSort={toggleSort} />
  </div>;
}

function FindingsList({ organizationId, repositoryId, severity, status, query, from, before, order, onSort }: { organizationId: string; repositoryId: string; severity: string; status: string; query: string; from: string; before: string; order: FindingsOrder; onSort: (sort: FindingsOrder["sort"]) => void }) {
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeFindingStatusChanges(organizationId, () => setRevision(value => value + 1)), [organizationId]);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors.at(-1);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ organizationId, action: "findings", repositoryId, severity, status, query, sort: order.sort, direction: order.direction });
    if (cursor) params.set("cursor", cursor);
    if (from) params.set("from", from);
    if (before) params.set("before", before);
    productFetch(`/api/reviews?${params}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load findings.");
      if (!controller.signal.aborted) { setData(value); setError(""); }
    }).catch(error => {
      if (controller.signal.aborted) return;
      reportBrowserError("browser.findings", error);
      setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organizationId, repositoryId, severity, status, query, from, before, cursor, revision, order.sort, order.direction]);
  const findings = data?.findings ?? [];
  const filtered = repositoryId !== "0" || severity !== "all" || status !== "all" || !!query || !!from || !!before;
  const goToPage = (next: (string | null)[]) => { setData(null); setError(""); setLoading(true); setCursors(next); };
  const sortDescription = order.sort === "date" ? (order.direction === "desc" ? "newest first" : "oldest first") : (order.direction === "desc" ? "highest severity first" : "lowest severity first");
  const sortButton = (column: FindingsOrder["sort"], label: string) => {
    const active = order.sort === column;
    const Icon = active ? (order.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    const nextAscending = active && order.direction === "desc";
    const action = column === "date" ? (nextAscending ? "Sort oldest first" : "Sort newest first") : (nextAscending ? "Sort lowest severity first" : "Sort highest severity first");
    return <button type="button" className={styles.sortButton} aria-pressed={active} onClick={() => onSort(column)} title={action} aria-label={`${label}: ${action.toLowerCase()}`}>{label}<Icon size={14} aria-hidden="true" /></button>;
  };

  return <section className={styles.panel} aria-label="Findings" aria-busy={loading}>
    <div className={styles.toolbar}>
      <h2 aria-live="polite">{data ? `${data.total.toLocaleString()} ${data.total === 1 ? "finding" : "findings"}` : "Results"}</h2>
      <div className={styles.sortControls} role="group" aria-label="Sort findings">
        <span>Sort by</span>{sortButton("date", "Review date")}{sortButton("severity", "Severity")}
        <span className="sr-only" role="status">{sortDescription}</span>
      </div>
      <button className={styles.refresh} type="button" title="Refresh findings" aria-label="Refresh findings" disabled={loading}
        onClick={() => { if (cursor) setData(null); setError(""); setLoading(true); setCursors([null]); setRevision(value => value + 1); }}><RefreshCw size={15} aria-hidden="true" /></button>
    </div>
    <Notification tone="error" message={error ? `${error}${data ? " Previously loaded findings are shown below." : " Use Refresh to try again."}` : ""} />
    <Notification tone="info" message={data && (data.unavailableRepositories > 0 || data.unavailableReports > 0) ? `Some findings could not be loaded (${data.unavailableRepositories} repositories, ${data.unavailableReports} reports). Showing available findings.` : ""} />
    {loading && !data && <p className={styles.empty} role="status">Loading findings…</p>}
    {data && findings.length === 0 && <div className={styles.empty} role="status"><h2>{data.unavailableRepositories || data.unavailableReports ? "No findings in the available reports" : filtered ? "No matching findings" : "No findings on this page"}</h2><p>{filtered ? "Try another search, widen the date range, or clear the filters." : "Findings appear here after a review completes. Refresh to load the latest results."}</p><Link href="/dashboard?view=reviews">Open reviews</Link></div>}
    {findings.length > 0 && <ul className={styles.results} aria-label="Finding results">
      {findings.map((finding, index) => {
        const date = new Date(finding.createdAt);
        return <li className={styles.result} key={`${finding.repositoryId}:${finding.jobId}:${finding.id}:${index}`} data-finding-status={finding.resolution?.status}>
          <div className={styles.badges}>
            <span className={styles.severity} data-severity={finding.severity}>{finding.severity}</span>
            {finding.advisory && <span className={styles.advisory}>Advisory</span>}
          </div>
          <div className={styles.details}>
            <h3 className={styles.finding}><Link prefetch={false} href={`/dashboard?${new URLSearchParams({ view: "reviews", repositoryId: String(finding.repositoryId), jobId: finding.jobId })}`} className={styles.findingLink}>{finding.title} <ArrowUpRight size={14} aria-hidden="true" /></Link></h3>
            <div className={styles.location}>{finding.path}{finding.line > 0 ? `:${finding.line}` : ""}</div>
            <div className={styles.context}>
              <span><FolderGit2 size={13} aria-hidden="true" />{finding.repository}</span>
              <span><GitPullRequest size={13} aria-hidden="true" />{finding.pullNumber ? `PR #${finding.pullNumber}` : "Review"}</span>
            </div>
          </div>
          <div className={styles.date}>{Number.isFinite(date.getTime()) ? <time dateTime={finding.createdAt} title={date.toLocaleString()}>
            <span className="sr-only">Reviewed </span>{date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}
            <span className={styles.hour}>{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</span>
          </time> : "—"}</div>
          {finding.resolution && <div className={styles.status}><FindingStatusControl inline value={finding.resolution} organizationId={organizationId} repositoryId={finding.repositoryId} jobId={finding.jobId} ordinal={finding.ordinal} findingId={finding.id} title={finding.title} /></div>}
        </li>;
      })}
    </ul>}
    {(data || cursors.length > 1) && <nav className={styles.pagination} aria-label="Findings pages">
      <span aria-live="polite">Page {cursors.length}</span>
      <div><button type="button" disabled={loading || cursors.length === 1} onClick={() => goToPage(cursors.slice(0, -1))}>Previous</button>
        <button type="button" disabled={loading || !data?.nextCursor} onClick={() => { if (data?.nextCursor) goToPage([...cursors, data.nextCursor]); }}>Next</button></div>
    </nav>}
  </section>;
}
