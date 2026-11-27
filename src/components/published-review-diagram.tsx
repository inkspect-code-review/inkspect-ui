"use client";

import { useEffect, useState, type ReactNode } from "react";
import { unified } from "unified";
import remarkParse from "remark-parse";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";
import type { ReviewReport } from "@inkspect/core/lib/review-types";
import styles from "./reviews.module.css";

export function publishedDiagramSource(summary?: string) {
  if (!summary) return;
  for (const block of unified().use(remarkParse).parse(summary).children) {
    if (block.type === "code" && block.lang === "mermaid") return block.value;
  }
}

export function PublishedReviewDiagram({ source, diagram, fallback }: {
  source: string; diagram: NonNullable<ReviewReport["diagram"]>; fallback: ReactNode;
}) {
  const [image, setImage] = useState<string>();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    async function render() {
      const { default: mermaid } = await import("mermaid");
      if (!active) return;
      mermaid.initialize({ startOnLoad: false, securityLevel: "strict", suppressErrorRendering: true, htmlLabels: false, flowchart: { useMaxWidth: false } });
      const host = document.createElement("div");
      host.className = styles.diagramMeasurement;
      host.setAttribute("aria-hidden", "true");
      document.body.append(host);
      try {
        const { svg } = await mermaid.render("review-" + crypto.randomUUID(), source, host);
        if (active) setImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
      } finally {
        host.remove();
      }
    }
    render().catch(error => {
      if (active) {
        reportBrowserError("browser.review.diagram", error);
        setFailed(true);
      }
    });
    return () => { active = false; };
  }, [source]);

  if (failed) return fallback;
  const labels = new Map(diagram.nodes.map(node => [node.id, node.label]));
  const connections = diagram.edges.map(edge =>
    [labels.get(edge.from), edge.label, labels.get(edge.to)].filter(Boolean).join(" → ")
  );
  const description = [diagram.title, ...labels.values(), ...connections].join(". ");
  return <figure className={styles.diagram}>
    <figcaption><strong>{diagram.title}</strong><span>{diagram.view === "proposed" ? "Proposed behavior" : "Current behavior"}</span></figcaption>
    <div className={styles.publishedGraph} aria-busy={!image}>
      {image
        // Mermaid produces an SVG with intrinsic dimensions. Keep it in an isolated image.
        // eslint-disable-next-line @next/next/no-img-element
        ? <img src={image} alt={description} />
        : <span role="status">Loading diagram…</span>}
    </div>
  </figure>;
}
