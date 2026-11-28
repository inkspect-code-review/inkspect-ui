"use client";
import { Notification } from "./notification-toast";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import type { ReportResponse, ReviewReport, ReviewScore } from "@inkspect/core/lib/review-types";
import { allFindingFixPrompts, findingFixPrompt } from "@inkspect/core/lib/review-prompts";
import styles from "./reviews.module.css";
import { FindingStatusControl } from "./finding-status-control";
import { PublishedReviewDiagram, publishedDiagramSource } from "./published-review-diagram";
import { downloadReviewSarif } from "./review-sarif";

// Historic reports can omit coverage, a verdict or a finding location.
export type SavedReport = Pick<ReviewReport, "summary" | "scores" | "change_alignment" | "diagram" | "presentation_notes" | "presentation" | "assessments" | "evidence"> & {
  decision: ReviewReport["decision"] | null;
  diagramSource?: string;
  run: Pick<ReviewReport["run"], "id" | "status" | "target" | "base" | "exclusions" | "review_notes"> & {
    coverage_complete: boolean | null;
    excludedFiles?: number | null;
    freshness?: ReviewReport["run"]["freshness"];
  };
  findings: (Omit<ReviewReport["findings"][number], "location"> & {
    location: { path: string; start_line?: number; end_line?: number } | null;
  })[];
  verification_gaps: { reason: string; blocking: boolean | null }[];
};
type DisplayValue = ReportResponse | {
  report: SavedReport;
  freshness_check?: undefined; finding_statuses?: undefined; fix_prompt?: undefined;
};

function CopyPromptButton({ value, label = "Copy", ariaLabel, className, successMessage = "Fix prompt copied to clipboard.", onFailure, onSuccess }: { value: string; label?: string; ariaLabel: string; className?: string; successMessage?: string; onFailure: () => void; onSuccess?: () => void }) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "failed">("idle");
  useEffect(() => {
    if (status !== "copied") return;
    const timer = setTimeout(() => setStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [status]);
  return <>
    <button type="button" className={className} aria-label={ariaLabel} disabled={!value.trim() || status === "copying"} onClick={async () => {
      setStatus("copying");
      try { await navigator.clipboard.writeText(value); setStatus("copied"); onSuccess?.(); }
      catch (error) { reportBrowserError("browser.review.report", error); setStatus("failed"); onFailure(); }
    }}>{status === "copied" ? "Copied" : status === "copying" ? "Copying…" : label}</button>
    <Notification tone={status === "failed" ? "error" : "success"} message={status === "copied" ? successMessage : status === "failed" ? "Could not copy to clipboard. The prompt is available below to copy manually." : ""} />
  </>;
}

function FixPrompt({ value, label = "AI fix prompt" }: { value: string; label?: string }) {
  const details = useRef<HTMLDetailsElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);
  return <div className={styles.prompt}>
    <details ref={details}><summary className={styles.promptSummary}>{label}</summary><textarea ref={textarea} aria-label={label} readOnly value={value} rows={9} /></details>
    <CopyPromptButton value={value} ariaLabel={`Copy ${label.toLowerCase()}`} className={styles.promptCopy} onFailure={() => {
      if (details.current) details.current.open = true;
      textarea.current?.focus();
      textarea.current?.select();
    }} />
  </div>;
}
const EvidenceNavigation = createContext<((id: string) => void) | null>(null);
function EvidenceLinks({ ids }: { ids?: string[] }) {
  const navigate = useContext(EvidenceNavigation);
  if (!ids?.length) return null;
  return <span className={styles.evidenceLinks}>{ids.map(id => <a key={id} href={`#evidence-${encodeURIComponent(id)}`} onClick={event => {
    if (navigate) { event.preventDefault(); navigate(id); }
  }}>{id}</a>)}</span>;
}
export function ReviewDiagram({ diagram }: { diagram: NonNullable<ReviewReport["diagram"]> }) {
  const marker = useId().replaceAll(":", "");
  const positions = new Map(diagram.nodes.map((node, index) => [node.id, { x: 130 + index % 3 * 250, y: 60 + Math.floor(index / 3) * 150 }]));
  const height = Math.max(160, Math.ceil(diagram.nodes.length / 3) * 150);
  return <figure className={styles.diagram}><figcaption><strong>{diagram.title}</strong><span>{diagram.view === "proposed" ? "Proposed behavior" : "Current behavior"}</span></figcaption><div className={styles.graphScroll}><svg viewBox={`0 0 780 ${height}`} role="img" aria-label={diagram.title}><defs><marker id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7" fill="currentColor" /></marker></defs>{diagram.edges.map((edge, index) => {
    const a = positions.get(edge.from), b = positions.get(edge.to); if (!a || !b) return null;
    const sameRow = a.y === b.y;
    const x1 = a.x + (sameRow ? (b.x > a.x ? 100 : -100) : 0), x2 = b.x + (sameRow ? (b.x > a.x ? -104 : 104) : 0);
    const y1 = a.y + (sameRow ? 0 : (b.y > a.y ? 30 : -30)), y2 = b.y + (sameRow ? 0 : (b.y > a.y ? -34 : 34));
    return <g key={index}><path d={`M${x1},${y1} L${x2},${y2}`} fill="none" stroke="currentColor" strokeDasharray={edge.missing ? "5 5" : undefined} markerEnd={`url(#${marker})`}><title>{edge.label || `${edge.from} to ${edge.to}`}</title></path></g>;
  })}{diagram.nodes.map((node) => { const p = positions.get(node.id)!; const words = node.label.match(/.{1,24}(?:\s|$)|.{1,24}/g) || [node.label]; return <g key={node.id} className={node.issue ? styles.issueNode : styles.node}><title>{node.label}</title><rect x={p.x - 100} y={p.y - 30} width={200} height={60} rx={6} /><text x={p.x} y={p.y - (Math.min(words.length, 3) - 1) * 8} textAnchor="middle">{words.slice(0, 3).map((word, i) => <tspan key={i} x={p.x} dy={i ? 16 : 0}>{word.trim()}</tspan>)}</text></g>; })}</svg></div></figure>;
}
function ReportDiagram({ report }: { report: SavedReport }) {
  if (!report.diagram) return null;
  const fallback = <ReviewDiagram diagram={report.diagram} />;
  const source = report.diagramSource || publishedDiagramSource(report.presentation?.github_summary);
  return source ? <PublishedReviewDiagram key={source} source={source} diagram={report.diagram} fallback={fallback} /> : fallback;
}

const decisions = {
  needs_changes: "Changes requested",
  needs_evidence: "More verification needed",
  ready_for_human: "Ready for review",
  ready_for_review: "Ready for review",
};
const alignmentLabels: Record<string, string> = { aligned: "Aligned", partial: "Partially aligned", partially_aligned: "Partially aligned", diverging: "Diverging from stated intent", misaligned: "Not aligned", unclear: "Unclear" };

function ScoreCard({ label, value }: { label: string; value: ReviewScore }) {
  const [copyFailed, setCopyFailed] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const prompt = `Improve ${label.toLowerCase()} to a 5/5 standard.\n\nContext: ${value.rationale || ""}\n\nTask: ${value.to_improve}`;
  useEffect(() => {
    if (!copyFailed) return;
    textarea.current?.focus();
    textarea.current?.select();
  }, [copyFailed]);
  return <section className={styles.scoreCard} data-tone={value.score >= 4 ? "success" : value.score >= 3 ? "warning" : "danger"} aria-label={label}>
    <header><h3>{label}</h3><span><strong>{value.score}</strong> / 5</span></header>
    <meter min={0} max={5} value={value.score} aria-label={`${label}: ${value.score} out of 5`} />
    {value.rationale && <p>{value.rationale}</p>}
    {value.to_improve && <div className={styles.scoreImprovement}>
      <div className={styles.improvementHeading}>
        <h4>How to improve</h4>
        <CopyPromptButton value={prompt} label="Copy prompt" ariaLabel={`Copy ${label.toLowerCase()} improvement prompt`} className={styles.improvementCopy} successMessage="Improvement prompt copied to clipboard." onFailure={() => setCopyFailed(true)} onSuccess={() => setCopyFailed(false)} />
      </div>
      <p>{value.to_improve}</p>
      {copyFailed && <div className={styles.copyFallback}><textarea ref={textarea} aria-label={`${label} improvement prompt`} readOnly value={prompt} rows={6} onFocus={event => event.currentTarget.select()} /></div>}
    </div>}
  </section>;
}

function Findings({ value, organizationId }: { value: DisplayValue; organizationId?: string }) {
  const r = value.report;
  const allPrompts = "finding_prompts" in value ? allFindingFixPrompts(value) : "";
  const [copyFailed, setCopyFailed] = useState(false);
  return <section id="review-findings" className={styles.reportSection} aria-labelledby="review-findings-title">
    <div className={styles.sectionHeading}><h3 id="review-findings-title">Findings <span className={styles.findingCount}>{r.findings.length}</span></h3>{"finding_prompts" in value && r.findings.length > 0 && <CopyPromptButton value={allPrompts} label="Copy fix prompts" ariaLabel="Copy fix prompts for all findings" onFailure={() => setCopyFailed(true)} onSuccess={() => setCopyFailed(false)} />}</div>
    {copyFailed && <div className={styles.copyFallback}><textarea aria-label="All finding fix prompts" readOnly value={allPrompts} rows={6} onFocus={event => event.currentTarget.select()} /></div>}
    {!r.findings.length && <p className={styles.muted}>No findings on the reviewed changes. Check the Verification tab before merging.</p>}
    <div className={styles.findingList}>{r.findings.map((f, index) => <article key={`${f.id}:${index}`} className={styles.finding} data-finding-status={value.finding_statuses?.[index]?.status}>
      <header><span className={styles.severity} data-severity={f.severity}>{f.severity}</span><h4>{f.title}</h4>{f.advisory && <span className={styles.badge}>Advisory</span>}</header>
      {f.location && <code className={styles.findingLocation}>{f.location.path}{f.location.start_line && `:${f.location.start_line}`}{f.location.end_line && f.location.end_line !== f.location.start_line ? `–${f.location.end_line}` : ""}</code>}
      <FindingStatusControl value={value.finding_statuses?.[index]} organizationId={organizationId} repositoryId={Number(r.run.target.repository_id)} jobId={r.run.id} ordinal={index + 1} findingId={f.id} title={f.title} />
      <p>{f.reason}</p>
      <details className={styles.findingDetail}><summary>Suggested fix & verification</summary><dl><dt>Suggested fix</dt><dd>{f.suggestion}</dd><dt>How to verify</dt><dd>{f.verification}</dd></dl><EvidenceLinks ids={f.evidence_ids} /></details>
      {"finding_prompts" in value && findingFixPrompt(value, f.id).trim() && <FixPrompt value={findingFixPrompt(value, f.id)} label="AI fix prompt" />}
    </article>)}</div>
  </section>;
}

function Evidence({ report: r }: { report: SavedReport }) {
  return <section id="review-evidence" className={styles.evidenceSection} aria-labelledby="review-evidence-title">
    <div className={styles.sectionHeading}><h3 id="review-evidence-title">Evidence</h3><span>{r.evidence.length}</span></div>
    {!r.evidence.length && <p className={styles.muted}>No separate evidence records were included.</p>}
    {r.evidence.map(e => <details key={e.id} id={`evidence-${encodeURIComponent(e.id)}`} tabIndex={-1} className={styles.evidence}>
      <summary><strong>{e.location?.path || e.id}</strong><span>{e.outcome.replaceAll("_", " ")}</span></summary>
      <dl className={styles.metadata}><div><dt>Reference</dt><dd>{e.id}</dd></div><div><dt>Kind</dt><dd>{e.kind}</dd></div><div><dt>Origin</dt><dd>{e.origin}</dd></div><div><dt>Revision</dt><dd>{e.revision.revision_id}</dd></div>{e.location && <div><dt>Lines</dt><dd>{e.location.start_line}–{e.location.end_line}</dd></div>}{e.execution_id && <div><dt>Execution</dt><dd>{e.execution_id}</dd></div>}{e.artifact_ref && <div><dt>Artifact</dt><dd>{e.artifact_ref}</dd></div>}</dl>
    </details>)}
  </section>;
}

export function ReviewReportView({ value, details, fix, organizationId }: { value: DisplayValue; details?: ReactNode; fix?: ReactNode; organizationId?: string }) {
  const r: SavedReport = value.report;
  const [tab, setTab] = useState("overview");
  const openEvidence = (id: string) => {
    setTab("verification");
    requestAnimationFrame(() => {
      const target = document.getElementById(`evidence-${encodeURIComponent(id)}`);
      if (target instanceof HTMLDetailsElement) target.open = true;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: "nearest", behavior: "instant" });
    });
  };
  return <article className={styles.report} aria-label="Review report">
    {r.run.freshness === "stale" && <p className={styles.notice}>The pull request or review context has changed. This report belongs to the recorded snapshot.</p>}
    <Notification tone="error" message={value.freshness_check === "unavailable" ? "Current PR freshness could not be checked." : ""} />
    {(r.run.coverage_complete === false || r.run.status !== "completed") && <p className={styles.notice}>Coverage is incomplete. Some areas could not be fully reviewed.</p>}
    <EvidenceNavigation.Provider value={openEvidence}>
    {r.findings.length > 0 && fix}
    <Tabs.Root value={tab} onValueChange={setTab}>
      <Tabs.List className={styles.reportTabs} aria-label="Review sections">
        <Tabs.Trigger className={styles.reportTab} value="overview">Overview</Tabs.Trigger>
        <Tabs.Trigger className={styles.reportTab} value="findings">Findings <span>{r.findings.length}</span></Tabs.Trigger>
        {r.diagram && <Tabs.Trigger className={styles.reportTab} value="map">Behavior map</Tabs.Trigger>}
        <Tabs.Trigger className={styles.reportTab} value="verification">Verification {r.verification_gaps.length > 0 && <span data-warning="true">{r.verification_gaps.length}</span>}</Tabs.Trigger>
        {details && <Tabs.Trigger className={styles.reportTab} value="details">Details</Tabs.Trigger>}
      </Tabs.List>
      <Tabs.Content className={styles.tabPanel} value="overview" forceMount hidden={tab !== "overview"}>
    <section className={styles.overview} aria-labelledby="review-decision">
      <div className={styles.sectionHeading}>
        <div className={styles.decision} data-decision={r.decision ?? undefined}><span aria-hidden="true" /><h2 id="review-decision">{r.decision ? decisions[r.decision] : "Review completed"}</h2></div>
        <button type="button" onClick={() => downloadReviewSarif(r)}>Download SARIF</button>
      </div>
      <p className={styles.reviewSummary}>{r.summary}</p>
      {r.change_alignment && <div className={styles.alignment}><h3>PR intent <span>{alignmentLabels[r.change_alignment.level] || r.change_alignment.level.replaceAll("_", " ")}</span></h3><p>{r.change_alignment.rationale}</p></div>}
    </section>
    {r.scores && <div className={styles.scoreGrid}><ScoreCard label="Code quality" value={r.scores.code_quality} /><ScoreCard label="Security" value={r.scores.security} /></div>}
      </Tabs.Content>
      <Tabs.Content className={styles.tabPanel} value="findings" forceMount hidden={tab !== "findings"}>
    <Findings value={value} organizationId={organizationId} />
    {value.fix_prompt && r.findings.length > 1 && <FixPrompt label="AI fix prompt for all findings and verification gaps" value={value.fix_prompt} />}
      </Tabs.Content>
      {r.diagram && <Tabs.Content className={styles.tabPanel} value="map"><ReportDiagram report={r} /></Tabs.Content>}
      <Tabs.Content className={styles.tabPanel} value="verification" forceMount hidden={tab !== "verification"}>
    <section id="review-verification" className={styles.reportSection} aria-labelledby="review-verification-title">
      <div className={styles.sectionHeading}><h3 id="review-verification-title">Verification & scope</h3><span>{r.verification_gaps.length ? `${r.verification_gaps.length} gaps` : "No reported gaps"}</span></div>
      {r.verification_gaps.map((gap, index) => <div className={styles.gap} key={index}><span className={styles.badge} data-warning={gap.blocking === true}>{gap.blocking === null ? "Verification gap" : gap.blocking ? "Blocking" : "Note"}</span><p>{gap.reason}</p></div>)}
      <p className={styles.scopeNote}>{r.run.coverage_complete === null ? "Coverage was not recorded for this review." : r.run.coverage_complete ? "Review coverage is complete for the included scope." : "Review coverage is incomplete."}{r.run.excludedFiles ? ` ${r.run.excludedFiles} changed files were excluded.` : r.run.exclusions?.excluded_files ? ` ${r.run.exclusions.excluded_files} changed files were excluded by .inkspectignore at ${r.run.exclusions.ignore.revision.revision_id.slice(0, 7)}.` : ""}</p>
      {!r.findings.length && value.fix_prompt && <FixPrompt label="AI verification prompt" value={value.fix_prompt} />}
      {!!r.assessments.length && <details className={styles.disclosure}><summary>Checks assessed <span>{r.assessments.length}</span></summary>{r.assessments.map((assessment, index) => <div className={styles.assessment} key={index}><strong>{assessment.target.id}</strong><span className={styles.badge}>{assessment.status.replaceAll("_", " ")}</span><p>{assessment.reason}</p><EvidenceLinks ids={assessment.evidence_ids} /></div>)}</details>}
    </section>
    <div className={styles.supportingDetails}>
      <Evidence report={r} />
      {!!(r.run.review_notes?.length || r.presentation_notes?.length) && <details className={styles.disclosure}><summary>Review notes</summary>{r.run.review_notes?.map((note, i) => <div key={i} className={styles.reviewNote}><strong>{note.author}</strong><p>{note.body}</p></div>)}{r.presentation_notes?.map((note, i) => <p key={i}>{note}</p>)}</details>}
    </div>
      </Tabs.Content>
      {details && <Tabs.Content className={styles.tabPanel} value="details">{details}</Tabs.Content>}
    </Tabs.Root>
    </EvidenceNavigation.Provider>
  </article>;
}
