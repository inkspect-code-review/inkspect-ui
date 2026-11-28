import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewFix } from "@inkspect/ui/components/review-fix";
import { ReviewCostView } from "@inkspect/ui/components/review-cost";
import { ReviewDiagram, ReviewReportView } from "@inkspect/ui/components/review-report";
import type { ReportResponse } from "@inkspect/core/lib/review-types";
import { allFindingFixPrompts, findingFixPrompt } from "@inkspect/core/lib/review-prompts";
import { publishedDiagramSource } from "../../../src/components/published-review-diagram";
import { reviewSarif, downloadReviewSarif } from "../../../src/components/review-sarif";

function fixture(): ReportResponse {
  const revision = { repository_id: "1", revision_id: "a".repeat(40) };
  return {
    freshness_check: "unavailable", freshness_checked_at: "2026-10-29T10:00:00Z", fix_prompt: "Fix the boundary", finding_prompts: { F1: "Test perfect squares" },
    report: {
      decision: "needs_changes", summary: "Boundary error in math helpers.",
      scores: { code_quality: { score: 3, rationale: "Missing boundary test", to_improve: "Include the square-root boundary" }, security: { score: 5, rationale: "No sensitive operations" } },
      change_alignment: { level: "partial", rationale: "Prime factors can be composite" },
      run: { id: "run", status: "completed", freshness: "stale", coverage_complete: false, target: revision, base: revision, model: { provider: "bedrock", model_id: "test" }, exclusions: { excluded_files: 2, ignore: { revision, digest: "b".repeat(64) } } },
      findings: [{ id: "F1", title: "Include the boundary", severity: "P1", reason: "<script>unsafe()</script>", suggestion: "Use <=", verification: "Run perfect-square tests", location: { path: "src/math.ts", start_line: 12, end_line: 14 }, evidence_ids: ["E1"] }],
      evidence: [{ id: "E1", kind: "source", origin: "repository", outcome: "observed", revision }],
      verification_gaps: [{ reason: "Tests could not run", blocking: true }], assessments: [],
      diagram: { title: "Math flow", view: "current", nodes: [{ id: "a", label: "Input" }], edges: [] },
    },
  };
}

test("SARIF download contains the recorded locations and coverage and keeps alert IDs across revisions", () => {
  const { report } = fixture();
  const finding = report.findings[0];
  finding.location.path = "src/çağrı #1%?.ts";
  report.findings.push({ ...finding, id: "F2", severity: "P3", location: { ...finding.location, start_line: 1, end_line: 1 } });
  const sarif = reviewSarif(report);
  const run = sarif.runs[0];
  assert.equal(sarif.version, "2.1.0");
  assert.equal(run.results.length, 2);
  assert.equal(run.invocations[0].executionSuccessful, false);
  assert.equal(run.properties.excludedFiles, 2);
  assert.equal(run.properties.revision, report.run.target.revision_id);
  assert.deepEqual(run.results.map(r => r.level), ["note", "error"]);
  const result = run.results[1];
  assert.equal(result.ruleId, run.tool.driver.rules[0].id);
  assert.deepEqual(result.locations[0].physicalLocation, {
    artifactLocation: { uri: "src/%C3%A7a%C4%9Fr%C4%B1%20%231%25%3F.ts", uriBaseId: "%SRCROOT%" },
    region: { startLine: 12, endLine: 14 },
  });
  assert.match(result.message.text, /Include the boundary/);
  assert.notDeepEqual(result.partialFingerprints, run.results[0].partialFingerprints);
  const previous = run.results.map(r => r.partialFingerprints);
  finding.id = "different-run-id";
  finding.title = " Include   the Boundary ";
  finding.severity = "medium";
  finding.location.start_line += 5;
  finding.location.end_line += 5;
  report.findings.reverse();
  report.run.target = { ...report.run.target, revision_id: "b".repeat(40) };
  const next = reviewSarif(report).runs[0];
  assert.deepEqual(next.results.map(r => r.partialFingerprints), previous);
  assert.equal(next.results[1].level, "warning");
  assert.doesNotMatch(JSON.stringify(next), /bedrock|Test perfect squares|private-provider/);
});

test("the overview downloads an empty, completed SARIF report as a local file", async () => {
  const value = fixture();
  value.report.findings = [];
  value.report.run.coverage_complete = true;
  const html = renderToStaticMarkup(<ReviewReportView value={value} />);
  assert.match(html, /<button type="button">Download SARIF<\/button>/);
  const link = { href: "", download: "", click() { clicked = true; } };
  let clicked = false;
  const previous = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    createElement(tag: string) { assert.equal(tag, "a"); return link; },
  } });
  try {
    downloadReviewSarif(value.report);
    assert.ok(clicked);
    assert.match(link.href, /^blob:/);
    assert.equal(link.download, `inkspect-${value.report.run.target.revision_id}.sarif`);
    const response = await fetch(link.href);
    assert.equal(response.headers.get("content-type"), "application/sarif+json");
    const [run] = (await response.json()).runs;
    assert.equal(run.invocations[0].executionSuccessful, true);
    assert.deepEqual(run.results, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, "document", previous);
    else Reflect.deleteProperty(globalThis, "document");
    URL.revokeObjectURL(link.href);
  }
});

test("structured reports work without Markdown and preserve important review information", () => {
  const html = renderToStaticMarkup(<ReviewReportView value={fixture()} />);
  for (const text of ["Changes requested", "Boundary error", "Code quality", "Security", "Partially aligned", "Prime factors", "src/math.ts:12–14", "Suggested fix", "Run perfect-square tests", "Tests could not run", "2 changed files were excluded", "coverage is incomplete", "could not be checked", "recorded snapshot", "Behavior map", "evidence-E1"]) assert.ok(html.toLowerCase().includes(text.toLowerCase()), text);
  assert.match(html, /&lt;script&gt;unsafe/);
  assert.doesNotMatch(html, /<script|<iframe|<pre/);
  assert.match(html, /<meter[^>]*value="3"/);
  assert.match(html, /<textarea[^>]*readonly/);
  assert.doesNotMatch(html, /<details[^>]* open/);
});

test("a legacy report without scores or diagram remains useful and shows verification prompts", () => {
  const value = fixture();
  delete value.report.scores; delete value.report.change_alignment; delete value.report.diagram;
  value.report.findings = [];
  const html = renderToStaticMarkup(<ReviewReportView value={value} />);
  assert.match(html, /No findings on the reviewed changes/);
  assert.match(html, /AI verification prompt/);
  assert.match(html, /Tests could not run/);
  assert.doesNotMatch(html, /formatted report is unavailable/);
});

test("finding resolution preserves the original report and distinguishes manual closure from automatic absence", () => {
  const value = fixture();
  value.finding_statuses = [{ status: "resolved", source: "manual", at: "2026-11-02T00:00:00Z" }];
  const manual = renderToStaticMarkup(<ReviewReportView value={value} organizationId="workspace" />);
  assert.match(manual, /Manually resolved/);
  assert.match(manual, /Undo manual resolution/);
  assert.match(manual, /Include the boundary/);
  assert.match(manual, /&lt;script&gt;unsafe/);
  value.finding_statuses = [{ status: "not_detected", source: "latest_review", reviewId: "latest", commit: "a".repeat(40) }];
  const absent = renderToStaticMarkup(<ReviewReportView value={value} organizationId="workspace" />);
  assert.match(absent, /Not detected in latest review/);
  assert.match(absent, /not a verified repair/);
  assert.doesNotMatch(absent, /Mark resolved/);
  assert.doesNotMatch(absent, /Verified AI fix/);
});


test("reports expose one visible tab and keep supplementary details off the overview", () => {
  const html = renderToStaticMarkup(<ReviewReportView value={fixture()} details={<p>Private run metadata</p>} />);
  assert.equal((html.match(/role="tab"/g) || []).length, 5);
  const panels = html.match(/<div[^>]*role="tabpanel"[^>]*>/g) || [];
  assert.equal(panels.filter(panel => !panel.includes('hidden=""')).length, 1);
  assert.doesNotMatch(html, /Private run metadata/);
  assert.match(html, /href="#evidence-E1"/);
  assert.match(html, /id="evidence-E1" tabindex="-1"/);
  assert.match(html, /data-tone="warning" aria-label="Code quality"/);
  assert.match(html, /data-tone="success" aria-label="Security"/);
});

test("one finding keeps its own prompt without a redundant bulk prompt", () => {
  const value = fixture();
  let html = renderToStaticMarkup(<ReviewReportView value={value} />);
  assert.match(html, /Test perfect squares/);
  assert.doesNotMatch(html, /AI fix prompt for all findings/);
  value.report.findings.push({ ...value.report.findings[0], id: "F2", title: "Another finding" });
  html = renderToStaticMarkup(<ReviewReportView value={value} />);
  assert.match(html, /AI fix prompt for all findings and verification gaps/);
});

test("copy actions are available without opening a finding prompt", () => {
  const value = fixture();
  const html = renderToStaticMarkup(<ReviewReportView value={value} />);
  assert.match(html, /aria-label="Copy fix prompts for all findings"[^>]*>Copy fix prompts<\/button>/);
  // The copy control is a sibling of details, so it remains visible when closed
  // and clicking it cannot trigger the summary's native toggle behavior.
  assert.match(html, /<\/details><button[^>]*aria-label="Copy ai fix prompt"[^>]*>Copy<\/button>/);
  assert.doesNotMatch(html, /<details[^>]* open/);
  value.report.findings = [];
  assert.doesNotMatch(renderToStaticMarkup(<ReviewReportView value={value} />), /Copy fix prompts for all findings/);
});

test("bulk copying preserves engine prompts in finding order and never copies a partial set", () => {
  const value = fixture();
  value.report.findings.push({ ...value.report.findings[0], id: "F2" });
  value.finding_prompts.unrelated = "Do not include a prompt outside this review";
  value.report.presentation = { version: 1, markdown: "", github_summary: "", github_findings: {}, finding_prompts: { F1: "Old prompt", F2: "Second engine prompt" }, fix_prompt: "Combined engine prompt" };
  assert.equal(findingFixPrompt(value, "F1"), "Test perfect squares");
  assert.equal(allFindingFixPrompts(value), "Test perfect squares\n\n---\n\nSecond engine prompt");
  delete value.report.presentation.finding_prompts.F2;
  assert.equal(allFindingFixPrompts(value), value.fix_prompt);
  value.fix_prompt = "";
  assert.equal(allFindingFixPrompts(value), "Combined engine prompt");
  value.report.presentation.fix_prompt = "";
  assert.equal(allFindingFixPrompts(value), "");
  value.report.findings = [];
  value.fix_prompt = "Only verification gaps";
  assert.equal(allFindingFixPrompts(value), "");
});

test("the review map reads the published flowchart verbatim and ignores nested example fences", () => {
  for (const direction of ["TD", "LR"]) {
    const graph = ['flowchart ' + direction, '    n0{"Valid?"}:::decision', '    n1["Save"]', '    n0 -.->|"yes"| n1'].join("\n");
    const summary = ["````text", "```mermaid", "example", "```", "````", "### Flow", "````mermaid", graph, "````"].join("\n");
    assert.equal(publishedDiagramSource(summary), graph);
  }
  assert.equal(publishedDiagramSource("No diagram"), undefined);
  assert.equal(publishedDiagramSource(), undefined);
});

test("behavior maps keep accessible edge labels without a repeated text legend", () => {
  const diagram = fixture().report.diagram!;
  diagram.nodes.push({ id: "b", label: "Output", evidence_ids: ["E1"] });
  diagram.edges.push({ from: "a", to: "b", label: "Validated path", evidence_ids: ["E1"] });
  const html = renderToStaticMarkup(<ReviewDiagram diagram={diagram} />);
  assert.match(html, /<title>Validated path<\/title>/);
  assert.doesNotMatch(html, /<ul|<li|href="#evidence/);
  assert.match(html, /<\/svg><\/div><\/figure>$/);
});

test("provider costs retain partial measurements without exposing individual model calls", () => {
  const html = renderToStaticMarkup(<ReviewCostView cost={{ version: 1, currency: "USD", basis: "provider_list_price", pricing_date: "2026-10-30", complete: false, total_nano_usd: null, measured_nano_usd: "12000000", estimated_nano_usd: "0", unmeasured_calls: 1,
    components: [{ category: "model", calls: 2, complete: false, cost_nano_usd: null, measured_nano_usd: "12000000", estimated_nano_usd: "0" }],
    calls: [{ id: "private-call", category: "model", model: "private-provider-model", region: "private-region", status: "unmeasured", cost_nano_usd: null, request_id: "private-request", reason: "private-provider-reason" }],
  }} />);
  assert.match(html, /Provider cost/);
  assert.match(html, /measured \(partial\)/);
  assert.match(html, /not counted as free/);
  assert.doesNotMatch(html, /Usage details|private-provider|private-region|private-request|private-call/);
});


test("the fix banner mounts once above the tabs and reserves space while PR state is checked", () => {
  const value = fixture();
  const props = { jobId: "J-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", pullUrl: "https://github.com/team/repo/pull/3", request: async () => ({ available: true, fix: null }), openFindingCount: 1, onReviewLatest: () => {} };
  const fix = <ReviewFix {...props} />;
  let mounts = 0;
  function Probe() { mounts++; return <span>Fix component</span>; }
  const html = renderToStaticMarkup(<ReviewReportView value={value} fix={<Probe />} />);
  assert.equal(mounts, 1);
  assert.ok(html.indexOf("Fix component") < html.indexOf('role="tablist"'), "fix action must be visible on Overview above all tabs");
  const loading = renderToStaticMarkup(fix);
  assert.match(loading, /1 open finding/);
  assert.match(loading, /<button[^>]*disabled=""[^>]*aria-busy="true"/);
  assert.match(loading, /Checking PR status…/);
  assert.match(loading, /Checking the PR on GitHub\./);
  assert.equal(renderToStaticMarkup(<ReviewFix {...props} openFindingCount={0} />), "", "resolved findings must not show an idle fix action");
  value.report.findings = [];
  assert.doesNotMatch(renderToStaticMarkup(<ReviewReportView value={value} fix={fix} />), /Fix with Inkspect AI/);
});

test("saved reports render the same tabs, scores and export with missing legacy metadata", () => {
  const { report } = fixture();
  const saved = { ...report, decision: null, run: { ...report.run, coverage_complete: null, excludedFiles: null },
    findings: report.findings.map(f => ({ ...f, location: null })), verification_gaps: [{ reason: "Manual check", blocking: null }] };
  const html = renderToStaticMarkup(<ReviewReportView value={{ report: saved }} details={<p>Saved run</p>} />);
  for (const text of ["Overview", "Findings", "Verification", "Details", "Download SARIF", "Review completed", "Coverage was not recorded"]) assert.ok(html.includes(text), text);
  assert.doesNotMatch(html, /Coverage is incomplete|Copy fix prompts|undefined:/);
  const run = reviewSarif(saved).runs[0];
  assert.equal(run.results.length, saved.findings.length);
  assert.deepEqual(run.results[0].locations, []);
  assert.equal("coverageComplete" in run.properties, false);
});
