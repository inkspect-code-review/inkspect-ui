"use client";

import { Fragment, useEffect, useState } from "react";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import { productFetch } from "@inkspect/core/lib/api-client";
import type { DashboardMember } from "@inkspect/core/lib/dashboard";
import {
  type UsageEntry, type UsageGroup, type UsageHistory, type UsagePresentation,
  usageNumber as number, usageCategoryLabel, usageRepository,
} from "@inkspect/core/lib/usage/usage-display";
import styles from "./usage.module.css";
import { UsageChart } from "./usage-chart";

type Category = "all" | "embedding" | "review" | "chat";

function useHistory<T>(presentation: UsagePresentation, organizationId: string, category: Category, days: number, page: number, revision: number, group?: string) {
  const [history, setHistory] = useState<UsageHistory<T> | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    void Promise.resolve().then(() => {
      setLoading(true); setError(""); setHistory(null);
      const query = new URLSearchParams({ organizationId, category, days: String(days), page: String(page), ...(group ? { group } : { groupBy: "day" }) });
      return productFetch(`/api/usage?${query}`, { cache: "no-store", signal: controller.signal });
    }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not load usage.");
      const history = presentation.read(body, !group);
      if (!controller.signal.aborted) setHistory(history as UsageHistory<T>);
    }).catch(error => { if (!controller.signal.aborted) { reportBrowserError("browser.usage.history", error); setError(error instanceof Error ? error.message : "Could not load usage. Please try again."); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [presentation, organizationId, category, days, page, revision, group]);
  return { history, error, loading };
}

function GroupDetails({ presentation, group, organizationId, category, days, revision }: { presentation: UsagePresentation; group: UsageGroup; organizationId: string; category: Category; days: number; revision: number }) {
  const [page, setPage] = useState(1);
  const { history, error, loading } = useHistory<UsageEntry>(presentation, organizationId, category, days, page, revision, group.id);
  return <div className={styles.groupDetails} aria-busy={loading}>
    <dl className={styles.detail}>
      <div><dt>Operations</dt><dd>{number(group.operations)}</dd></div>
      <div><dt>Calls / units</dt><dd>{number(group.calls)} / {number(group.units)}</dd></div>
      <div><dt>Total recorded tokens</dt><dd>{number(group.total_tokens)}</dd></div>
      <div><dt>Cache read tokens</dt><dd>{number(group.cached_input_tokens)}</dd></div>
      <div><dt>Cache write tokens</dt><dd>{number(group.cache_write_input_tokens ?? null)}</dd></div>
    </dl>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    {loading && <p className={styles.empty}>Loading operations…</p>}
    {history && <div className={styles.tableWrap}><table aria-label="Individual usage operations">
      <thead><tr><th scope="col">Time</th><th scope="col">Input / output tokens</th><th scope="col">{presentation.amountLabel}</th><th scope="col">Details</th></tr></thead>
      <tbody>{history.records.map(row => <tr key={row.id}>
        <td>{new Date(row.started_at).toLocaleString()}</td>
        <td>{number(row.input_tokens)} / {number(row.output_tokens)}</td>
        <td>{row.amount === null ? null : presentation.formatAmount(row.amount)}</td>
        <td><details><summary>Details</summary>
          <dl className={styles.detail}>
            <div><dt>Operation</dt><dd>{row.operation_id}</dd></div>
            <div><dt>Repository</dt><dd>{row.repository_name || row.repository_id || "Workspace"}</dd></div>
            {row.category === "review" && <div><dt>Review model</dt><dd>{row.model || "—"}</dd></div>}
            <div><dt>Calls / units</dt><dd>{number(row.calls)} / {number(row.units)}</dd></div>
            <div><dt>Cache read / write tokens</dt><dd>{number(row.cached_input_tokens)} / {number(row.cache_write_input_tokens ?? null)}</dd></div>
            <div><dt>Duration</dt><dd>{row.duration_ms === null ? "—" : `${(Number(row.duration_ms) / 1000).toFixed(1)}s`}</dd></div>
            <div><dt>Finished</dt><dd>{row.finished_at ? new Date(row.finished_at).toLocaleString() : "—"}</dd></div>
          </dl>
        </details></td>
      </tr>)}</tbody>
    </table></div>}
    <Pagination page={page} loading={loading} hasMore={!!history?.has_more} onChange={setPage} label="Operations page" />
  </div>;
}

function Pagination({ page, loading, hasMore, onChange, label = "Page" }: { page: number; loading: boolean; hasMore: boolean; onChange: (page: number) => void; label?: string }) {
  return <div className={styles.pagination}>
    <button disabled={loading || page === 1} onClick={() => onChange(page - 1)}>Previous</button>
    <span>{label} {page}</span>
    <button disabled={loading || !hasMore || page >= 200} onClick={() => onChange(page + 1)}>Next</button>
  </div>;
}

export function UsagePanel({ organizationId, members, presentation }: { organizationId: string; members: DashboardMember[]; presentation: UsagePresentation }) {
  const [category, setCategory] = useState<Category>("all");
  const [days, setDays] = useState(30);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { history, error, loading } = useHistory<UsageGroup>(presentation, organizationId, category, days, page, revision);
  const amount = history?.totals.reduce((sum, total) => sum + BigInt(total.amount), 0n) || 0n;
  return <div className={styles.usage} aria-busy={loading}>
    <div className={styles.toolbar}>
      <div className={styles.filters} role="group" aria-label="Usage category">
        {(["all", "embedding", "review", "chat"] as Category[]).map(value => <button key={value} aria-pressed={category === value} onClick={() => { setCategory(value); setPage(1); setExpanded(null); }}>{value === "all" ? "All usage" : usageCategoryLabel(value)}</button>)}
      </div>
      <div className={styles.controls}>
        <label>Period<span className={styles.selectField}><select value={days} onChange={event => { setDays(Number(event.target.value)); setPage(1); setExpanded(null); }}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></span></label>
        <button onClick={() => setRevision(value => value + 1)} disabled={loading}>Refresh</button>
      </div>
    </div>
    {error && <p role="alert" className={styles.error}>{error}</p>}
    <div className={styles.summary}>
      <div><span>{presentation.totalLabel}</span><strong>{history ? presentation.formatAmount(amount.toString()) : "—"}</strong></div>
      {["embedding", "review", "chat"].map(value => {
        const total = history?.totals.find(total => total.category === value);
        return <div key={value}><span>{usageCategoryLabel(value)}</span><strong>{history ? presentation.formatAmount(total?.amount || "0") : "—"}</strong>
          <small>{history ? `${number(total?.operations || 0)} operations · ${number(total?.total_tokens || "0")} recorded tokens` : error ? "Usage unavailable" : "Loading usage…"}</small>
        </div>;
      })}
    </div>
    {(loading || history?.daily !== undefined) && <UsageChart daily={history?.daily} loading={loading} />}
    <section className={styles.panel} aria-label="Usage history">
      <p className={styles.groupHint}>Daily usage by category and member, with reviews and indexing grouped by repository. Open details for individual operations.</p>
      <div className={styles.tableWrap}><table><thead><tr>
        <th scope="col">Day (UTC)</th><th scope="col">Category</th><th scope="col">Member</th><th scope="col">Calls</th><th scope="col">Input tokens</th><th scope="col">Output tokens</th><th scope="col">{presentation.amountLabel}</th><th scope="col"><span className={styles.srOnly}>Details</span></th>
      </tr></thead><tbody>{history?.records.map(row => <Fragment key={row.id}>
        <tr>
          <td>{new Date(`${row.day}T00:00:00Z`).toLocaleDateString(undefined, { timeZone: "UTC" })}<small>{number(row.operations)} operations</small></td>
          <td><strong>{usageCategoryLabel(row.category)}</strong>{usageRepository(row) && <small>{usageRepository(row)}</small>}</td>
          <td>{members.find(member => member.id === row.user_id)?.name || "Workspace"}</td>
          <td>{number(row.calls)}</td>
          <td>{number(row.input_tokens)}{row.input_tokens !== null && row.missing_input_tokens > 0 && <small>Partial</small>}</td>
          <td>{number(row.output_tokens)}{row.output_tokens !== null && row.missing_output_tokens > 0 && <small>Partial</small>}</td>
          <td>{row.amount === null ? null : presentation.formatAmount(row.amount)}</td>
          <td><button aria-expanded={expanded === row.id} aria-controls={`usage-group-${row.id}`} onClick={() => setExpanded(expanded === row.id ? null : row.id)}>{expanded === row.id ? "Hide" : "Details"}</button></td>
        </tr>
        {expanded === row.id && <tr id={`usage-group-${row.id}`}><td colSpan={8}><GroupDetails presentation={presentation} key={`${organizationId}:${category}:${days}:${revision}:${row.id}`} group={row} organizationId={organizationId} category={category} days={days} revision={revision} /></td></tr>}
      </Fragment>)}</tbody></table></div>
      {!loading && !error && !history?.records.length && <p className={styles.empty}>No {category === "all" ? "AI" : usageCategoryLabel(category).toLowerCase()} usage recorded for this period.</p>}
      {loading && <p className={styles.empty}>Loading usage…</p>}
      <Pagination page={page} loading={loading} hasMore={!!history?.has_more} onChange={value => { setPage(value); setExpanded(null); }} />
    </section>
    <p className={styles.note}>{presentation.note}</p>
  </div>;
}
