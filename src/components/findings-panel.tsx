"use client";

import { Notification } from "./notification-toast";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, ChevronDown, RefreshCw, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import type { FindingRow, FindingsOrder, FindingsResponse } from "@inkspect/core/lib/findings";
import type { ReviewRepository } from "@inkspect/core/lib/review-types";
import { FindingsDateFilter } from "./findings-date-filter";
import { reviewDateBounds, type FindingsPeriod } from "./findings-date-range";
import { SearchableSelect } from "./ui/searchable-select";
import { RepositoryConnectionCard } from "./repository-connection-card";
import styles from "./findings.module.css";
import { FindingStatusControl } from "./finding-status-control";
import { subscribeFindingStatusChanges } from "@inkspect/core/lib/finding-status-events";

const statusOptions = [{ value: "all", label: "All history" }, { value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "not_detected", label: "Not detected in latest review" }, { value: "historical", label: "Earlier reviews" }];

export function FindingsPanel({ organizationId, workspaceName, canManage, connected, repositories, findingsEndpoint }: { organizationId: string; workspaceName: string; canManage: boolean; connected: boolean; repositories: ReviewRepository[]; findingsEndpoint?: string }) {
  const params = useSearchParams();
  const [severity, setSeverity] = useState("all");
  const requestedStatus = params.get("status");
  const status = statusOptions.find(option => option.value === requestedStatus)?.value ?? "all";
  function setUrlFilter(key: "status" | "repositoryId", value: string, defaultValue: string) {
    const url = new URL(window.location.href);
    if (value === defaultValue) url.searchParams.delete(key);
    else url.searchParams.set(key, value);
    window.history.replaceState(null, "", url);
  }
  const setStatus = (value: string) => setUrlFilter("status", value, "all");
  const setRepositoryId = (value: string) => setUrlFilter("repositoryId", value, "0");
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<FindingsPeriod>("all");
  const { from, before } = reviewDateBounds(period);
  const [search, setSearch] = useState("");
  const [order, setOrder] = useState<FindingsOrder>({ sort: "date", direction: "desc" });
  const [catalog, setCatalog] = useState<{ status: "loading" | "ready" | "error"; repositories: ReviewRepository[] }>({ status: "loading", repositories });
  const choices = findingsEndpoint ? repositories : catalog.repositories;
  const repositoryId = choices.some(repo => String(repo.id) === params.get("repositoryId")) ? params.get("repositoryId")! : "0";
  const repositoryRevision = JSON.stringify(repositories);
  useEffect(() => {
    if (!connected || findingsEndpoint) return;
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
  }, [organizationId, connected, repositoryRevision, findingsEndpoint]);
  const toggleSort = (sort: FindingsOrder["sort"]) => setOrder(current => ({ sort, direction: current.sort === sort && current.direction === "desc" ? "asc" : "desc" }));
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);
  const hasFilters = repositoryId !== "0" || severity !== "all" || status !== "all" || !!query || period !== "all";
  if (!connected || ((findingsEndpoint || catalog.status === "ready") && !choices.length)) return <RepositoryConnectionCard section="findings" workspaceName={workspaceName} canManage={canManage} />;
  if (!choices.length) return catalog.status === "error" ? <Notification tone="error" message="Your review repositories couldn’t be loaded. Refresh the page to try again." action={{ label: "Refresh page", onClick: () => window.location.reload() }} /> : <p className={styles.empty} role="status">Loading review repositories…</p>;
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
            options={[{ value: "0", label: "All repositories" }, ...choices.map(repository => ({ value: String(repository.id), label: `${repository.full_name}${repository.archived ? " (Disconnected)" : ""}` }))]}
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
          <SearchableSelect id="findings-status" label="Status" value={status} onValueChange={setStatus} options={statusOptions} placeholder="All history" searchPlaceholder="Search status…" emptyMessage="No matching status." />
        </div>
        <button className={styles.reset} type="button" disabled={!hasFilters} onClick={() => {
          setRepositoryId("0"); setSeverity("all"); setStatus("all"); setQuery(""); setSearch(""); setPeriod("all");
        }}>Clear filters</button>
      </div>
    </div>
    <FindingsList endpoint={findingsEndpoint ?? "/api/reviews"} key={JSON.stringify([organizationId, findingsEndpoint, repositoryId, severity, status, search, from, before, order])} organizationId={organizationId} repositoryId={repositoryId} severity={severity} status={status} query={search} from={from} before={before} order={order} onSort={toggleSort} />
  </div>;
}

function FindingsList({ endpoint, organizationId, repositoryId, severity, status, query, from, before, order, onSort }: { endpoint: string; organizationId: string; repositoryId: string; severity: string; status: string; query: string; from: string; before: string; order: FindingsOrder; onSort: (sort: FindingsOrder["sort"]) => void }) {
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
    productFetch(`${endpoint}?${params}`, { cache: "no-store", signal: controller.signal }).then(async response => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load findings.");
      if (!controller.signal.aborted) { setData(value); setError(""); }
    }).catch(error => {
      if (controller.signal.aborted) return;
      reportBrowserError("browser.findings", error);
      setError(error.message);
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint, organizationId, repositoryId, severity, status, query, from, before, cursor, revision, order.sort, order.direction]);
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
    {findings.length > 0 && <FindingsTimeline findings={findings} organizationId={organizationId} />}
    {(data || cursors.length > 1) && <nav className={styles.pagination} aria-label="Findings pages">
      <span aria-live="polite">Page {cursors.length}</span>
      <div><button type="button" disabled={loading || cursors.length === 1} onClick={() => goToPage(cursors.slice(0, -1))}>Previous</button>
        <button type="button" disabled={loading || !data?.nextCursor} onClick={() => { if (data?.nextCursor) goToPage([...cursors, data.nextCursor]); }}>Next</button></div>
    </nav>}
  </section>;
}

export function FindingsTimeline({ findings, organizationId }: { findings: FindingRow[]; organizationId: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const today = now.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();
  const days: { label: string; findings: FindingRow[] }[] = [];
  // Group adjacent rows so severity sorting and API cursor order stay intact.
  for (const finding of findings) {
    const date = new Date(finding.createdAt);
    const day = date.toDateString();
    const label = day === today ? "Today" : day === yesterday ? "Yesterday" : Number.isFinite(date.getTime())
      ? date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      : "Unknown date";
    const last = days.at(-1);
    if (last?.label === label) last.findings.push(finding);
    else days.push({ label, findings: [finding] });
  }
  return <ol className={styles.timeline} aria-label="Finding results">
    {days.map(day => <li className={styles.day} key={findingKey(day.findings[0])}>
      <header className={styles.dayHeader}>
        <h3>{day.label}</h3>
        <span title="Findings shown in this group">{day.findings.length} {day.findings.length === 1 ? "finding" : "findings"}</span>
      </header>
      <ul className={styles.results} aria-label={day.label}>
        {day.findings.map(finding => <FindingItem key={findingKey(finding)} finding={finding} organizationId={organizationId} now={now} />)}
      </ul>
    </li>)}
  </ol>;
}

function findingKey(finding: FindingRow) {
  return `${finding.repositoryId}:${finding.jobId}:${finding.ordinal}`;
}

const priorities: Record<string, string> = { critical: "P0", high: "P1", medium: "P2", low: "P3" };

function timelineTime(date: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (date.toDateString() === now.toDateString() && minutes >= 0) {
    if (minutes === 0) return "now";
    return minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h`;
  }
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function FindingItem({ finding, organizationId, now }: { finding: FindingRow; organizationId: string; now: Date }) {
  const date = new Date(finding.createdAt);
  const validDate = Number.isFinite(date.getTime());
  const location = finding.path + (finding.line > 0 ? `:${finding.line}` : "");
  return <li className={styles.result} data-finding-status={finding.resolution?.status}>
    <span className={styles.marker} data-severity={finding.severity} title={`${finding.severity} severity`}>
      <span aria-hidden="true">{priorities[finding.severity] ?? "•"}</span>
      <span className="sr-only">{finding.severity} severity</span>
    </span>
    <div className={styles.details}>
      <h4 className={styles.finding}><Link prefetch={false} href={`/dashboard?${new URLSearchParams({ view: "reviews", repositoryId: String(finding.repositoryId), jobId: finding.jobId })}`} className={styles.findingLink}>{finding.title}</Link></h4>
      <p className={styles.context}>{finding.repository}{finding.pullNumber && ` · PR #${finding.pullNumber}`}{finding.advisory && " · Advisory"}</p>
    </div>
    <div className={styles.rowStatus}>
      {finding.resolution ? <FindingStatusControl inline value={finding.resolution} organizationId={finding.readOnly ? undefined : organizationId} repositoryId={finding.repositoryId} jobId={finding.jobId} ordinal={finding.ordinal} findingId={finding.id} title={finding.title} /> : <span>Status unavailable</span>}
    </div>
    <div className={styles.actions}>
      {validDate ? <time dateTime={finding.createdAt} title={date.toLocaleString()} aria-label={`Reviewed ${date.toLocaleString()}`}>{timelineTime(date, now)}</time> : "—"}
      <Popover.Root>
        <Popover.Trigger asChild><button type="button" className={styles.detailToggle} aria-label={`Details for ${finding.title}`}><ChevronDown size={14} aria-hidden="true" /></button></Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={4} collisionPadding={12} className={styles.detailPopover} aria-label="Finding details">
            <p className={styles.filePath}>{location}</p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  </li>;
}
