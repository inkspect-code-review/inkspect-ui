"use client";

import { Notification } from "./notification-toast";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, ArrowUpRight, RefreshCw, Search } from "lucide-react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import type { FindingsOrder, FindingsResponse } from "@inkspect/core/lib/findings";
import type { ReviewRepository } from "@inkspect/core/lib/review-types";
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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
  const invalidDates = !!dateFrom && !!dateTo && dateFrom > dateTo;
  const hasFilters = repositoryId !== "0" || severity !== "all" || status !== "all" || !!query || !!dateFrom || !!dateTo;
  if (!connected || (catalog.status === "ready" && !catalog.repositories.length)) return <RepositoryConnectionCard section="findings" workspaceName={workspaceName} canManage={canManage} />;
  if (!catalog.repositories.length) return catalog.status === "error" ? <Notification tone="error" message="Your review repositories couldn’t be loaded. Refresh the page to try again." action={{ label: "Refresh page", onClick: () => window.location.reload() }} /> : <p className={styles.empty} role="status">Loading review repositories…</p>;
  return <div className={styles.workspace}>
    {connected && <div className={styles.filters}>
    <div className={`${styles.filter} ${styles.searchFilter}`}>
      <label htmlFor="findings-search">Search findings</label>
      <div className={styles.searchInput}><Search size={16} aria-hidden="true" /><input id="findings-search" type="search" maxLength={300} value={query} onChange={event => setQuery(event.target.value)} placeholder="Search by finding title or file name…" /></div>
    </div><div className={styles.filter}>
      <label htmlFor="findings-repository">Repository</label>
      <SearchableSelect id="findings-repository" label="Repository" value={repositoryId} onValueChange={setRepositoryId}
        options={[{ value: "0", label: "All repositories" }, ...catalog.repositories.map(repository => ({ value: String(repository.id), label: `${repository.full_name}${repository.archived ? " (Disconnected)" : ""}` }))]}
        placeholder="All repositories" searchPlaceholder="Search repositories…" emptyMessage="No repositories found." />
    </div><div className={`${styles.filter} ${styles.severityFilter}`}>
      <label htmlFor="findings-severity">Severity</label>
      <SearchableSelect id="findings-severity" label="Severity" value={severity} onValueChange={setSeverity}
        options={[{ value: "all", label: "All severities" }, { value: "critical", label: "Critical (P0)" }, { value: "high", label: "High (P1)" }, { value: "medium", label: "Medium (P2)" }, { value: "low", label: "Low (P3)" }]}
        placeholder="All severities" searchPlaceholder="Search severities…" emptyMessage="No severities found." />
    </div><div className={`${styles.filter} ${styles.severityFilter}`}>
      <label htmlFor="findings-status">Status</label>
      <SearchableSelect id="findings-status" label="Status" value={status} onValueChange={setStatus} options={[{ value: "all", label: "All history" }, { value: "open", label: "Open" }, { value: "resolved", label: "Resolved" }, { value: "not_detected", label: "Not detected in latest review" }, { value: "historical", label: "Earlier reviews" }]} placeholder="All history" searchPlaceholder="Search status…" emptyMessage="No matching status." />
    </div><div className={`${styles.filter} ${styles.dateFilter}`}>
      <label htmlFor="findings-date-from">Review date from</label>
      <input id="findings-date-from" type="date" value={dateFrom} max={dateTo || undefined} onChange={event => setDateFrom(event.target.value)} aria-invalid={invalidDates} />
    </div><div className={`${styles.filter} ${styles.dateFilter}`}>
      <label htmlFor="findings-date-to">Review date to</label>
      <input id="findings-date-to" type="date" value={dateTo} min={dateFrom || undefined} onChange={event => setDateTo(event.target.value)} aria-invalid={invalidDates} />
    </div>
    {hasFilters && <div className={styles.filterActions}>
      <Notification tone="error" message={invalidDates ? "Start date must be on or before the end date." : ""} />
      <button type="button" onClick={() => { setRepositoryId("0"); setSeverity("all"); setStatus("all"); setQuery(""); setSearch(""); setDateFrom(""); setDateTo(""); }}>Clear filters</button>
    </div>}
    </div>}
    {!invalidDates && <FindingsList key={JSON.stringify([repositoryId, severity, status, search, dateFrom, dateTo, order])} organizationId={organizationId} connected={connected} repositoryId={repositoryId} severity={severity} status={status} query={search} dateFrom={dateFrom} dateTo={dateTo} order={order} onSort={toggleSort} />}
  </div>;
}

function FindingsList({ organizationId, connected, repositoryId, severity, status, query, dateFrom, dateTo, order, onSort }: { organizationId: string; connected: boolean; repositoryId: string; severity: string; status: string; query: string; dateFrom: string; dateTo: string; order: FindingsOrder; onSort: (sort: FindingsOrder["sort"]) => void }) {
  const [data, setData] = useState<FindingsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(connected);
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeFindingStatusChanges(organizationId, () => setRevision(value => value + 1)), [organizationId]);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors.at(-1);
  useEffect(() => {
    if (!connected) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ organizationId, action: "findings", repositoryId, severity, status, query, sort: order.sort, direction: order.direction });
    if (cursor) params.set("cursor", cursor);
    // Send local midnight boundaries, so DST and the inclusive end day match the table.
    if (dateFrom) params.set("from", new Date(`${dateFrom}T00:00:00`).toISOString());
    if (dateTo) {
      const end = new Date(`${dateTo}T00:00:00`);
      end.setDate(end.getDate() + 1);
      params.set("before", end.toISOString());
    }
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
  }, [organizationId, connected, repositoryId, severity, status, query, dateFrom, dateTo, cursor, revision, order.sort, order.direction]);
  const findings = data?.findings ?? [];
  const filtered = severity !== "all" || status !== "all" || !!query || !!dateFrom || !!dateTo;
  const goToPage = (next: (string | null)[]) => { setData(null); setError(""); setLoading(true); setCursors(next); };
  const sortDescription = order.sort === "date" ? (order.direction === "desc" ? "newest first" : "oldest first") : (order.direction === "desc" ? "highest severity first" : "lowest severity first");
  const sortHeading = (column: FindingsOrder["sort"], label: string) => {
    const active = order.sort === column;
    const Icon = active ? (order.direction === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    const nextAscending = active && order.direction === "desc";
    const action = column === "date" ? (nextAscending ? "Sort oldest first" : "Sort newest first") : (nextAscending ? "Sort lowest severity first" : "Sort highest severity first");
    return <th scope="col" aria-sort={active ? (order.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={styles.sortButton} onClick={() => onSort(column)} title={action} aria-label={`${label}: ${action.toLowerCase()}`}>{label}<Icon size={14} aria-hidden="true" /></button>
    </th>;
  };

  return <section className={styles.panel} aria-label="Findings" aria-busy={loading}>
    <div className={styles.toolbar}><div><h2>Findings{data && <span className={styles.count} aria-live="polite">{data.total}</span>}</h2><p>From all completed reviews {repositoryId === "0" ? "across all repositories" : "in this repository"}, {sortDescription}.</p></div>
      <button type="button" disabled={loading} onClick={() => { setData(null); setError(""); setLoading(true); setCursors([null]); setRevision(value => value + 1); }}><RefreshCw size={15} aria-hidden="true" />{loading ? "Loading…" : "Refresh"}</button>
    </div>
    <Notification tone="error" message={error ? `${error}${data ? " Previously loaded findings are shown below." : " Use Refresh to try again."}` : ""} />
    <Notification tone="info" message={data && (data.unavailableRepositories > 0 || data.unavailableReports > 0) ? `Some findings could not be loaded (${data.unavailableRepositories} repositories, ${data.unavailableReports} reports). Showing available findings.` : ""} />
    {loading && !data && <p className={styles.empty} role="status">Loading findings…</p>}
    {data && findings.length === 0 && <div className={styles.empty} role="status"><h2>{data.unavailableRepositories || data.unavailableReports ? "No findings in the available reports" : filtered ? "No matching findings" : "No findings on this page"}</h2><p>{filtered ? "Try another search, widen the date range, or clear the filters." : "Findings appear here after a review completes. Refresh to load the latest results."}</p><Link href="/dashboard?view=reviews">Open reviews</Link></div>}
    {findings.length > 0 && <div className={styles.tableScroll}><table className={styles.table}>
      <caption className="sr-only">Findings. Select a finding to open its review.</caption>
      <thead><tr>{sortHeading("severity", "Severity")}<th scope="col">Finding</th><th scope="col">Status</th><th scope="col">Repository / PR</th>{sortHeading("date", "Review date")}<th scope="col"><span className="sr-only">Open review</span></th></tr></thead>
      <tbody>{findings.map((finding, index) => {
        const date = new Date(finding.createdAt);
        return <tr key={`${finding.repositoryId}:${finding.jobId}:${finding.id}:${index}`} data-finding-status={finding.resolution?.status}>
          <td><span className={styles.severity} data-severity={finding.severity}>{finding.severity}</span>{finding.advisory && <small className={styles.advisory}>Advisory</small>}</td>
          <td className={styles.finding}><Link prefetch={false} href={`/dashboard?${new URLSearchParams({ view: "reviews", repositoryId: String(finding.repositoryId), jobId: finding.jobId })}`} className={styles.findingLink}>{finding.title}</Link><span className={styles.location}>{finding.path}{finding.line > 0 ? `:${finding.line}` : ""}</span></td>
          <td><FindingStatusControl compact value={finding.resolution} organizationId={organizationId} repositoryId={finding.repositoryId} jobId={finding.jobId} ordinal={finding.ordinal} findingId={finding.id} title={finding.title} /></td>
          <td><span className={styles.repository}>{finding.repository}</span><small>{finding.pullNumber ? `PR #${finding.pullNumber}` : "Review"}</small></td>
          <td className={styles.date}>{Number.isFinite(date.getTime()) ? <time dateTime={finding.createdAt} title={date.toLocaleString()}>{date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}<small>{date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</small></time> : "—"}</td>
          <td><ArrowUpRight size={16} aria-hidden="true" /></td>
        </tr>;
      })}</tbody>
    </table></div>}
    {(data || cursors.length > 1) && <nav className={styles.pagination} aria-label="Findings pages">
      <span aria-live="polite">Page {cursors.length}{data ? ` · ${data.total.toLocaleString()} matching findings` : ""}</span>
      <div><button type="button" disabled={loading || cursors.length === 1} onClick={() => goToPage(cursors.slice(0, -1))}>Previous</button>
        <button type="button" disabled={loading || !data?.nextCursor} onClick={() => { if (data?.nextCursor) goToPage([...cursors, data.nextCursor]); }}>Next</button></div>
    </nav>}
  </section>;
}
