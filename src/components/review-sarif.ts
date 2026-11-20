import type { ReviewReport } from "@inkspect/core/lib/review-types";

const ruleId = "inkspect/code-review";
const levels: Record<string, string> = {
  p0: "error", critical: "error", p1: "error", high: "error",
  p2: "warning", medium: "warning", p3: "note", low: "note",
};

// Reports contain locations and finding text, but do not retain the source file.
// Use the normalized title at the path as the anchor. Number repeated anchors in
// source order so a change in severity, commit or absolute line doesn't renumber them.
function anchorHash(path: string, title: string) {
  const anchor = JSON.stringify([path, title.trim().replace(/\s+/g, " ").toLowerCase()]);
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(anchor)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, "0");
}

export function reviewSarif({ run, findings }: ReviewReport) {
  const occurrences = new Map<string, number>();
  const ordered = [...findings].sort((a, b) => a.location.start_line - b.location.start_line || a.location.end_line - b.location.end_line);
  const results = ordered.map(finding => {
    const { path, start_line, end_line } = finding.location;
    const hash = anchorHash(path, finding.title);
    const occurrence = (occurrences.get(hash) ?? 0) + 1;
    occurrences.set(hash, occurrence);
    return {
      ruleId,
      level: levels[finding.severity.toLowerCase()] ?? "warning",
      message: { text: [finding.title, finding.reason].filter(Boolean).join("\n\n") },
      locations: [{ physicalLocation: {
        artifactLocation: { uri: path.split("/").map(encodeURIComponent).join("/"), uriBaseId: "%SRCROOT%" },
        region: { startLine: start_line, endLine: end_line },
      } }],
      partialFingerprints: { primaryLocationLineHash: `${hash}:${occurrence}` },
      properties: { severity: finding.severity, advisory: finding.advisory === true },
    };
  });
  const complete = run.status === "completed" && run.coverage_complete;
  return {
    $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json",
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "Inkspect", rules: [{ id: ruleId, shortDescription: { text: "Code review finding" } }] } },
      originalUriBaseIds: { "%SRCROOT%": { description: { text: "Root of the reviewed repository." } } },
      invocations: [{ executionSuccessful: complete, ...(!complete && { toolExecutionNotifications: [
        { level: "warning", message: { text: "Inkspect could not review the full requested scope." } },
      ] }) }],
      properties: { revision: run.target.revision_id, baseRevision: run.base.revision_id, coverageComplete: run.coverage_complete, excludedFiles: run.exclusions?.excluded_files ?? 0 },
      results,
    }],
  };
}

export function downloadReviewSarif(report: ReviewReport) {
  const data = JSON.stringify(reviewSarif(report), null, 2);
  const url = URL.createObjectURL(new Blob([data], { type: "application/sarif+json" }));
  try {
    const link = document.createElement("a");
    link.href = url;
    link.download = `inkspect-${report.run.target.revision_id.replace(/[^a-z0-9_-]/gi, "_").slice(0, 48)}.sarif`;
    link.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
