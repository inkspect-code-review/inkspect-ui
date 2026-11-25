"use client";

import { useDashboardWidgets } from "./dashboard-edition";
import { ReviewSettingsSummary } from "./review-settings-summary";
import { ReviewPullTitle } from "./review-pull-title";
import { Notification } from "./notification-toast";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import { subscribeReviews } from "@inkspect/core/lib/review-realtime";
import { subscribeFindingStatusChanges } from "@inkspect/core/lib/finding-status-events";
import { overviewSeverities, type OverviewDecision, type OverviewReview, type OverviewSeverity, type ReviewOverview } from "@inkspect/core/lib/review-overview";
import type { WorkspaceStatus } from "@inkspect/core/lib/workspace-status";
import type { DashboardSummary } from "@inkspect/core/lib/dashboard";
import { DashboardIcon, type DashboardIconName } from "./dashboard-icon";
import shared from "./dashboard.module.css";
import styles from "./dashboard-overview.module.css";

const dayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const monthFormat = new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" });
const dateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
const timeFormat = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit", timeZone: "UTC" });
const severityLabels: Record<OverviewSeverity, string> = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const decisions: Record<OverviewDecision, { label: string; detail: string; tone: string }> = {
  needs_changes: { label: "Needs changes", detail: "Inkspect found issues to fix before this pull request is merged.", tone: "attention" },
  needs_evidence: { label: "Needs more evidence", detail: "Some findings couldn’t be verified. Check the evidence before merging.", tone: "caution" },
  ready_for_human: { label: "No blocking issues found", detail: "No blocking issues found in the reviewed changes.", tone: "good" },
  ready_for_review: { label: "No blocking issues found", detail: "No blocking issues found in the reviewed changes.", tone: "good" },
};
const plural = (count: number, one: string, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const reviewHref = (review: OverviewReview) => `/dashboard?${new URLSearchParams({ view: "reviews", repositoryId: String(review.repositoryId), jobId: review.id })}`;
const reviewName = (review: OverviewReview) => `${review.repository}${review.number ? ` #${review.number}` : ""}`;
const when = (value: string) => Number.isNaN(Date.parse(value)) ? "" : `${dateFormat.format(new Date(value))} at ${timeFormat.format(new Date(value))} UTC`;

export type InitialReviewOverview = ReviewOverview & { realtime_channel?: string };

type OverviewState = { status: "loading" } | { status: "ready"; overview: ReviewOverview } | { status: "unavailable" };

function useReviewOverview(organizationId: string | undefined, initialOverview?: InitialReviewOverview) {
  const [state, setState] = useState<OverviewState>(() => initialOverview ? { status: "ready", overview: initialOverview } : { status: "loading" });
  const [revision, setRevision] = useState(0);
  const [channel, setChannel] = useState(initialOverview?.realtime_channel ?? "");
  useEffect(() => {
    if (!organizationId) return;
    return subscribeFindingStatusChanges(organizationId, () => setRevision(value => value + 1));
  }, [organizationId]);
  useEffect(() => {
    if (!organizationId) return;
    // A snapshot without a channel still needs subscription metadata.
    if (initialOverview?.realtime_channel && revision === 0) return;
    const controller = new AbortController();
    productFetch(`/api/reviews?${new URLSearchParams({ organizationId, action: "overview" })}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const value = await response.json();
      if (!response.ok) throw new Error(value.error || "Could not load review activity.");
      if (controller.signal.aborted) return;
      setState({ status: "ready", overview: value });
      if (typeof value.realtime_channel === "string") setChannel(value.realtime_channel);
    }).catch((error) => {
      if (controller.signal.aborted) return;
      reportBrowserError("browser.dashboard.overview", error);
      // Keep the last good overview on a failed refresh.
      setState((current) => current.status === "ready" ? current : { status: "unavailable" });
    });
    return () => controller.abort();
  }, [organizationId, revision, initialOverview]);
  useEffect(() => {
    if (!channel || !organizationId) return;
    let debounce: ReturnType<typeof setTimeout>;
    const dispose = subscribeReviews({ channel, organizationId, onState: () => {}, onMessage: () => {}, onRefresh: () => { clearTimeout(debounce); debounce = setTimeout(() => setRevision((value) => value + 1), 1500); } });
    return () => { clearTimeout(debounce); dispose(); };
  }, [channel, organizationId]);
  return organizationId ? state : { status: "unavailable" as const };
}

type DashboardOverviewProps = { summary: DashboardSummary; github?: WorkspaceStatus; organizationId?: string; initialOverview?: InitialReviewOverview };

export function DashboardOverview(props: DashboardOverviewProps) {
  return <LoadedDashboardOverview key={JSON.stringify([props.organizationId, props.initialOverview?.asOf])} {...props} />;
}

function LoadedDashboardOverview({ summary, github, organizationId, initialOverview }: DashboardOverviewProps) {
  const state = useReviewOverview(organizationId, initialOverview);
  const overview = state.status === "ready" && state.overview.totals.reviews > 0 ? state.overview : null;
  return <DashboardOverviewView organizationId={organizationId} summary={summary} github={github} overview={overview} loading={state.status === "loading"} unavailable={state.status === "unavailable"} />;
}

export function DashboardOverviewView({ organizationId, summary, github, overview, loading, unavailable = false }: { organizationId?: string; summary: DashboardSummary; github?: WorkspaceStatus; overview: ReviewOverview | null; loading: boolean; unavailable?: boolean }) {
  const repositories = github?.repositories ?? [];
  const connections = github?.connections ?? [];
  const hasRepositories = repositories.length > 0;

  const { overviewCard } = useDashboardWidgets();
  const reviewSummary = loading ? <div className={styles.loading} role="status" aria-live="polite"><span className={styles.loadingBar} /><span>Loading your reviews…</span></div>
      : unavailable ? <Notification tone="error" message="Your saved reviews couldn’t be loaded. Refresh the page to try again." action={{ label: "Refresh page", onClick: () => window.location.reload() }} />
      : overview ? <ReviewMetrics overview={overview} repositoryCount={repositories.length} overviewCard={overviewCard} />
      : <section className={styles.reviewStart} aria-labelledby="start-review-heading">
      <div className={styles.reviewIntro}>
        <span className={styles.reviewMark}><DashboardIcon name="reviews" /></span>
        <div><h2 id="start-review-heading">{hasRepositories ? "Start with a pull request." : "Bring your code into focus."}</h2>
          <p>{hasRepositories ? "Choose a change to review with the context of your repository and your team." : "Connect GitHub to review pull requests with the context of your codebase."}</p>
          <div className={styles.startActions}>{hasRepositories ? <><Link className={shared.primaryButton} href="/dashboard?view=reviews">Open reviews</Link><Link className={styles.textLink} href="/dashboard?view=repositories">Browse repositories</Link></> : github?.canManage ? <Link className={shared.primaryButton} href="/dashboard?view=integrations"><DashboardIcon name="plus" />Connect GitHub</Link> : <span className={styles.managerNote}>A workspace owner or admin can connect GitHub.</span>}</div>
        </div>
      </div>
      <ol className={styles.reviewSteps} aria-label="How to start a review">
        <li><DashboardIcon name="repositories" /><span>Select a repository</span></li>
        <li><DashboardIcon name="reviews" /><span>Choose a pull request</span></li>
        <li><DashboardIcon name="findings" /><span>Explore the findings</span></li>
      </ol>
    </section>;

  return <div className={styles.overview}>
    {overviewCard && !overview ? <div className={styles.summaryRow}>{overviewCard}{reviewSummary}</div> : reviewSummary}

    <div className={styles.workspaceGrid}>
      <div className={styles.mainColumn}>
        {overview?.latest && <LatestReview latest={overview.latest} />}
        {overview && <ReviewActivity daily={overview.daily} />}
        {!!overview?.recent.length && <RecentReviews reviews={overview.recent} organizationId={organizationId} repositories={repositories} />}
        <section className={`${shared.panel} ${styles.repositoryPanel}`} aria-labelledby="connected-repositories-heading">
          <div className={styles.panelHeading}><div><h2 id="connected-repositories-heading">Your repositories <span className={styles.count}>{repositories.length}</span></h2><p>The code connected to this workspace.</p></div><Link className={styles.textLink} href="/dashboard?view=repositories">View all<DashboardIcon name="arrow" /></Link></div>
          {hasRepositories ? <ul className={styles.repositories}>{repositories.slice(0, 6).map((repo) => <li key={repo.id}>
            <Link className={styles.repoLink} href={`/dashboard?${new URLSearchParams({ view: "repositories", repositoryId: String(repo.id) })}`}>
            <span className={styles.repoIcon}><DashboardIcon name="repositories" /></span>
            <span className={styles.repoName}><strong>{repo.fullName}</strong><small>GitHub repository</small></span>
            <span className={styles.visibility}>{repo.private ? <><DashboardIcon name="lock" />Private</> : "Public"}</span>
            </Link>
          </li>)}</ul> : <div className={styles.repositoryEmpty}><DashboardIcon name="repositories" /><h3>No repositories connected</h3><p>Once GitHub is connected, the repositories you select will appear here.</p></div>}
          <div className={styles.repositoryFooter}><span>{connections.length} GitHub {connections.length === 1 ? "account" : "accounts"} connected{repositories.length > 6 ? `, ${repositories.length - 6} more repositories` : ""}</span><Link href="/dashboard?view=integrations">Manage connections</Link></div>
        </section>
      </div>

      <aside className={styles.context} aria-label="Workspace context">
        {organizationId && <ReviewSettingsSummary key={organizationId} organizationId={organizationId} />}
        {overview && <SeverityBreakdown overview={overview} />}
        <section className={styles.team} aria-labelledby="workspace-heading">
          <h2 id="workspace-heading">Working together</h2>
          <dl className={styles.workspaceFacts}><div><dt>Team members</dt><dd>{summary.memberCount}</dd></div><div><dt>GitHub accounts</dt><dd>{connections.length}</dd></div></dl>
          {connections.length > 0 && <ul className={styles.accounts}>{connections.map((connection) => <li key={connection.id}><span aria-hidden="true">{connection.accountLogin.slice(0, 1).toUpperCase()}</span><strong>{connection.accountLogin}</strong></li>)}</ul>}
          <Link className={styles.textLink} href="/dashboard?view=members">View team members<DashboardIcon name="arrow" /></Link>
        </section>
        <section className={styles.knowledge} aria-labelledby="workspace-knowledge-heading">
          <DashboardIcon name="knowledge" />
          <h2 id="workspace-knowledge-heading">Your team’s way of building.</h2>
          <p>Add architecture notes, conventions, and review guidelines so Inkspect has your team’s context.</p>
          <Link className={styles.textLink} href="/dashboard?view=knowledge">Open Knowledge Center<DashboardIcon name="arrow" /></Link>
        </section>
      </aside>
    </div>
    <Notification tone="error" message={overview && overview.unavailable > 0 ? `Reviews from ${plural(overview.unavailable, "repository", "repositories")} couldn’t be loaded and aren’t counted here. Refresh the page to try again.` : ""} action={{ label: "Refresh page", onClick: () => window.location.reload() }} />
  </div>;
}

function ReviewMetrics({ overview, repositoryCount, overviewCard }: { overview: ReviewOverview; repositoryCount: number; overviewCard?: ReactNode }) {
  const { totals, decisions: verdicts } = overview;
  const attention = verdicts.needs_changes + verdicts.needs_evidence;
  return <nav className={styles.metrics} aria-label={overviewCard ? "Workspace overview" : "Review metrics"}>
    {overviewCard}
    <MetricCard href="/dashboard?view=reviews" icon="reviews" label="Completed reviews" value={totals.completed}
      detail={totals.active ? `${totals.active} in progress now` : totals.failed ? `${totals.failed} didn’t finish` : "Across your repositories"} />
    <MetricCard href="/dashboard?view=findings&status=open" icon="findings" label="Open findings" value={overview.findingStatus?.open ?? "—"}
      detail={overview.findingStatus ? `${overview.findingStatus.resolved} resolved · ${overview.findingStatus.notDetected} not detected in latest review` : "Finding status temporarily unavailable"} />
    <MetricCard href="/dashboard?view=reviews" icon="check" label="Reviews without blockers" value={(verdicts.ready_for_human ?? 0) + (verdicts.ready_for_review ?? 0)}
      detail={attention ? `${attention} recorded reviews need changes or evidence` : "No blocking issues found"} />
    {!overviewCard && <MetricCard href="/dashboard?view=repositories" icon="repositories" label="Repositories reviewed" value={totals.repositories}
      detail={`${repositoryCount} currently connected`} />}
  </nav>;
}

function MetricCard({ href, icon, label, value, detail }: { href: string; icon: DashboardIconName; label: string; value: number | string; detail: string }) {
  return <Link href={href} className={styles.metricCard}>
    <span className={styles.metricLabel}><DashboardIcon name={icon} />{label}</span>
    <strong className={styles.metricValue}>{value}</strong>
    <span className={styles.metricDetail}>{detail}</span>
  </Link>;
}

// The newest verdict: the thing a reviewer acts on next.
function LatestReview({ latest }: { latest: OverviewReview }) {
  const decision = latest.decision ? decisions[latest.decision] : null;
  const found = latest.severities ? overviewSeverities.filter((severity) => latest.severities![severity] > 0) : [];
  return <section className={`${shared.panel} ${styles.latest} ${styles[`tone_${decision?.tone ?? "neutral"}`]}`} aria-labelledby="latest-review-heading">
    <div className={styles.latestBody}>
      <p className={styles.latestContext}>Latest review of <a href={latest.url} target="_blank" rel="noreferrer">{reviewName(latest)}</a>{when(latest.createdAt) ? `, ${when(latest.createdAt)}` : ""}</p>
      <h2 id="latest-review-heading">{decision?.label ?? "Review completed"}</h2>
      <p className={styles.latestDetail}>{decision?.detail ?? "Open the review to see its report."}</p>
      {latest.severities && <ul className={styles.latestFindings} aria-label="Findings in this review">
        {found.length ? found.map((severity) => <li key={severity}><span className={styles[`dot_${severity}`]} aria-hidden="true" />{latest.severities![severity]} {severityLabels[severity].toLowerCase()}</li>)
          : <li><DashboardIcon name="check" />No findings</li>}
      </ul>}
    </div>
    <div className={styles.latestActions}><Link className={shared.primaryButton} href={reviewHref(latest)}>Open review</Link><Link className={styles.textLink} href="/dashboard?view=reviews">All reviews</Link></div>
  </section>;
}

const activityWeeks = 53;
type ActivityDay = ReviewOverview["daily"][number];
const utcDay = (date: string) => new Date(`${date}T00:00:00Z`);

// Month labels by week column. A label needs about three columns, so labels
// squeezed by a partial month at either end are dropped.
function monthLabels(weeks: (ActivityDay | null)[][]) {
  const labels: { month: string; index: number }[] = [];
  weeks.forEach((week, index) => {
    const first = week.find((day) => day);
    const month = first ? monthFormat.format(utcDay(first.date)) : "";
    if (month && month !== labels[labels.length - 1]?.month) labels.push({ month, index });
  });
  return labels.filter((label, position) => (labels[position + 1]?.index ?? weeks.length + 1) - label.index >= 3);
}

// GitHub-style activity for the last year: a day-by-week calendar, or the same
// weeks as bars. Both views share columns and height, so switching keeps the
// time axis in place.
function ReviewActivity({ daily }: { daily: ActivityDay[] }) {
  const [view, setView] = useState<"calendar" | "bars">("calendar");
  const scroller = useRef<HTMLDivElement>(null);
  // When the year doesn't fit (small screens), keep the newest weeks in view.
  useLayoutEffect(() => { const element = scroller.current; if (element) element.scrollLeft = element.scrollWidth; }, [view]);
  if (!daily.length) return null;
  // Columns are Monday-first weeks; the last one ends today.
  const todayIndex = (utcDay(daily[daily.length - 1].date).getUTCDay() + 6) % 7;
  const needed = (activityWeeks - 1) * 7 + todayIndex + 1;
  const recent = daily.slice(-needed);
  const cells: (ActivityDay | null)[] = [...Array<null>(needed - recent.length).fill(null), ...recent];
  const weeks = Array.from({ length: activityWeeks }, (_, index) => cells.slice(index * 7, index * 7 + 7));
  const totals = weeks.map((week) => ({
    completed: week.reduce((sum, day) => sum + (day?.completed ?? 0), 0),
    failed: week.reduce((sum, day) => sum + (day?.failed ?? 0), 0),
  }));
  const completed = totals.reduce((sum, week) => sum + week.completed, 0);
  const failed = totals.reduce((sum, week) => sum + week.failed, 0);
  const months = monthLabels(weeks);
  const level = (count: number) => count >= 4 ? 3 : count >= 2 ? 2 : count;
  const label = (date: string) => dayFormat.format(utcDay(date));
  const outcome = (done: number, missed: number) => `${plural(done, "review")} completed${missed ? `, ${missed} didn’t finish` : ""}`;
  const summary = `${outcome(completed, failed)} in the last year.`;
  // Round the bar axis up so a single review doesn't fill the whole height.
  const peak = Math.max(1, ...totals.map((week) => week.completed + week.failed));
  const top = peak <= 4 ? 4 : Math.ceil(peak / 4) * 4;
  const monthRow = <div className={styles.months} aria-hidden="true">{months.map(({ month, index }) => <span key={index} style={{ gridColumn: index + 1 }}>{month}</span>)}</div>;
  return <section className={`${shared.panel} ${styles.activityPanel}`} aria-labelledby="review-activity-heading">
    <div className={styles.panelHeading}>
      <div><h2 id="review-activity-heading">Review activity</h2><p>{summary}</p></div>
      <div className={styles.viewToggle} role="group" aria-label="Chart type">
        <button type="button" aria-pressed={view === "calendar"} aria-label="Calendar" title="Calendar" onClick={() => setView("calendar")}><DashboardIcon name="dashboard" /></button>
        <button type="button" aria-pressed={view === "bars"} aria-label="Bar chart" title="Bar chart" onClick={() => setView("bars")}><DashboardIcon name="usage" /></button>
      </div>
    </div>
    <div className={styles.activityBody}>
      <div className={styles.activityChart} style={{ "--weeks": activityWeeks } as CSSProperties}>
        {view === "calendar"
          ? <div className={styles.weekdays} aria-hidden="true"><span>Mon</span><span /><span>Wed</span><span /><span>Fri</span><span /><span /></div>
          : <div className={styles.axis} aria-hidden="true">{[top, top / 2, 0].map((value) => <span key={value}>{value}</span>)}</div>}
        <div className={styles.activityScroll} ref={scroller}>
          {view === "calendar" ? <div className={styles.calendar} role="img" aria-label={summary}>
            {monthRow}
            <div className={styles.days} aria-hidden="true">
              {cells.map((day, index) => day
                ? <span key={day.date} className={`${styles.cell} ${styles[`level${level(day.completed)}`]}`} title={`${label(day.date)}: ${outcome(day.completed, day.failed)}`} />
                : <span key={`pad-${index}`} />)}
            </div>
          </div>
          : <div className={styles.bars} role="img" aria-label={`${summary} Shown per week.`}>
            <div className={styles.plot} aria-hidden="true">
              <span className={styles.gridlines}><i /><i /><i /></span>
              {weeks.map((week, index) => {
                const first = week.find((day) => day);
                const { completed: done, failed: missed } = totals[index];
                return <span key={index} className={styles.week} title={first ? `Week of ${label(first.date)}: ${outcome(done, missed)}` : undefined}>
                  {missed > 0 && <i className={styles.barFailed} style={{ height: `${missed / top * 100}%` }} />}
                  {done > 0 && <i className={styles.barCompleted} style={{ height: `${done / top * 100}%` }} />}
                </span>;
              })}
            </div>
            {monthRow}
          </div>}
        </div>
      </div>
      {view === "calendar"
        ? <div className={styles.legend} aria-hidden="true"><span>Fewer</span><i className={styles.level0} /><i className={styles.level1} /><i className={styles.level2} /><i className={styles.level3} /><span>More</span></div>
        : <div className={styles.legend} aria-hidden="true"><i className={styles.barCompleted} /><span>Completed per week</span>{failed > 0 && <><i className={styles.barFailed} /><span>Didn’t finish</span></>}</div>}
    </div>
  </section>;
}

function SeverityBreakdown({ overview }: { overview: ReviewOverview }) {
  const severities = overview.findingStatus?.severities ?? { critical: 0, high: 0, medium: 0, low: 0 };
  const unknown = !overview.findingStatus;
  const largest = Math.max(1, ...overviewSeverities.map((severity) => severities[severity]));
  return <section className={styles.severity} aria-labelledby="findings-heading">
    <h2 id="findings-heading">Open findings by severity</h2>
    <p>{unknown ? "Finding status is temporarily unavailable." : overview.findingStatus!.open ? `${plural(overview.findingStatus!.open, "open finding")} from the latest completed review of each PR.` : "No open findings in the latest completed reviews."}</p>
    {!unknown && <ul className={styles.severityList}>{overviewSeverities.map((severity) => <li key={severity} className={severities[severity] ? "" : styles.severityEmpty}>
      <span className={styles.severityLabel}><span className={styles[`dot_${severity}`]} aria-hidden="true" />{severityLabels[severity]}</span>
      <strong>{severities[severity]}</strong>
      <span className={styles.severityTrack} aria-hidden="true"><span className={styles[`fill_${severity}`]} style={{ width: `${severities[severity] / largest * 100}%` }} /></span>
    </li>)}</ul>}
  </section>;
}

function RecentReviews({ reviews, organizationId, repositories }: { reviews: OverviewReview[]; organizationId?: string; repositories: WorkspaceStatus["repositories"] }) {
  const status = (review: OverviewReview) => review.status === "completed" ? review.decision ? decisions[review.decision].label : "Completed"
    : review.status === "failed" ? "Didn’t finish" : review.status === "cancelled" ? "Cancelled" : review.status === "paused" ? "Waiting for credit" : "In progress";
  const tone = (review: OverviewReview) => review.status === "completed" ? review.decision ? decisions[review.decision].tone : "neutral"
    : review.status === "failed" || review.status === "cancelled" ? "muted" : "active";
  return <section className={`${shared.panel} ${styles.recentPanel}`} aria-labelledby="recent-reviews-heading">
    <div className={styles.panelHeading}><div><h2 id="recent-reviews-heading">Recent reviews</h2><p>The newest saved reviews across your workspace.</p></div><Link className={styles.textLink} href="/dashboard?view=reviews">View all<DashboardIcon name="arrow" /></Link></div>
    <ul className={styles.recent}>{reviews.map((review) => <li key={review.id}>
      <Link href={reviewHref(review)} className={styles[`tone_${tone(review)}`]}>
        <span className={styles.recentMark} aria-hidden="true" />
        <span className={styles.recentName}>
          <strong>{reviewName(review)}</strong>
          <ReviewPullTitle title={review.title} number={review.number} repositoryId={review.repositoryId}
            organizationId={repositories.some(repo => repo.id === review.repositoryId) ? organizationId : undefined} fallback={"\u00a0"} className={styles.recentTitle} />
          <small>{when(review.createdAt)}</small>
        </span>
        <span className={styles.recentFindings}>{review.findings === null ? "" : review.findingStates?.resolved ? `${review.findingStates.resolved} resolved${review.findingStates.notDetected ? ` · ${review.findingStates.notDetected} not detected` : ""}` : review.findingStates?.notDetected ? `${review.findingStates.notDetected} not detected in latest review` : review.findingStates?.historical ? plural(review.findingStates.historical, "earlier finding") : review.findings ? plural(review.findings, "finding") : "No findings"}</span>
        <span className={styles.recentStatus}>{status(review)}</span>
      </Link>
    </li>)}</ul>
  </section>;
}
