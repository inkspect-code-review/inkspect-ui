"use client";

import { Notification, useNotificationMessage } from "./notification-toast";

import { useState } from "react";
import Link from "next/link";
import { productFetch } from "@inkspect/core/lib/api-client";
import { findingStatusLabels, type FindingStatusInfo } from "@inkspect/core/lib/finding-status";
import { announceFindingStatusChange } from "@inkspect/core/lib/finding-status-events";
import styles from "./finding-status-control.module.css";

export function FindingStatusControl({ value, organizationId, repositoryId, jobId, ordinal, findingId, title, compact = false, inline = false }: { value?: FindingStatusInfo; organizationId?: string; repositoryId: number; jobId: string; ordinal: number; findingId: string; title: string; compact?: boolean; inline?: boolean }) {
  const [updated, setUpdated] = useState<{ original: FindingStatusInfo | undefined; value: FindingStatusInfo } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError, errorNotificationKey] = useNotificationMessage("");
  const info = updated && updated.original === value ? updated.value : value;
  if (!info) return null;
  const manual = info.source === "manual";
  const explanation = manual ? "Manually resolved" : info.source === "verified_fix" ? "Verified AI fix" : info.status === "not_detected" ? "Not reported in a newer complete review. This is not a verified repair." : info.status === "historical" ? "A newer review exists. This finding has not been individually rechecked." : "Reported in the latest completed review of this PR.";
  const date = info.at && !Number.isNaN(Date.parse(info.at)) ? new Date(info.at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "";
  const reference = info.reviewId && <Link prefetch={false} className={styles.reference} title={`${explanation}${date ? ` · ${date}` : ""}`} href={`/dashboard?${new URLSearchParams({ view: "reviews", repositoryId: String(repositoryId), jobId: info.reviewId })}`}>{info.source === "verified_fix" ? "Review details" : "Latest review"}{info.commit ? ` · ${info.commit.slice(0, 7)}` : ""}</Link>;
  async function save() {
    if (!organizationId || pending) return;
    setPending(true); setError("");
    try {
      const response = await productFetch(`/api/reviews?${new URLSearchParams({ organizationId, action: "finding-status", repositoryId: String(repositoryId), jobId })}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ordinal, findingId, resolved: !manual }) });
      const result = await response.json();
      if (!response.ok || !result.resolution) throw new Error(result.error || "Could not update the finding.");
      setUpdated({ original: value, value: result.resolution });
      announceFindingStatusChange(organizationId);
    } catch (error) { setError(error instanceof Error ? error.message : "Could not update the finding."); }
    finally { setPending(false); }
  }
  return <div className={styles.control} data-compact={compact || undefined} data-inline={inline || undefined}>
    <span className={styles.status} data-status={info.status} title={explanation}>{findingStatusLabels[info.status]}</span>
    {compact || inline ? <div className={styles.metadata}>{manual ? <span>{explanation}{date && <> · <time dateTime={info.at}>{date}</time></>}</span> : reference}</div> : <>
      {(manual || info.source === "verified_fix") && <small>{explanation}{info.commit ? ` · ${info.commit.slice(0, 7)}` : ""}</small>}
      {date && <small><time dateTime={info.at}>{date}</time></small>}
      {reference}
    </>}
    {organizationId && (info.status !== "resolved" || manual) && <button type="button" onClick={() => void save()} disabled={pending} aria-busy={pending} aria-label={`${manual ? "Undo manual resolution for" : "Mark as resolved:"} ${title}`}>{manual ? "Undo manual resolution" : "Mark resolved"}</button>}
    <span className="sr-only" role="status">{pending ? "Saving finding status…" : ""}</span>
    <Notification tone="error" message={error} notificationKey={errorNotificationKey} />
  </div>;
}
