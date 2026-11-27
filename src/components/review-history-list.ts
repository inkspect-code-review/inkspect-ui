import type { ReactNode } from "react";
import type { ReviewJob, ReviewRepository } from "@inkspect/core/lib/review-types";

export type HistoryEntry = {
  id: string; repositoryId: number; repositoryName?: string; number: string; head: string;
  createdAt: string; status: string; summary?: ReviewJob["finding_summary"];
};
export type AdditionalHistory = {
  connected: boolean;
  repositories: ReviewRepository[];
  linkedId?: string;
  read(repository: number, page: number, signal: AbortSignal): Promise<{ entries: HistoryEntry[]; hasMore: boolean }>;
  detail(id: string, repository: number): ReactNode;
};

export function historyEntries(jobs: ReviewJob[], additional: HistoryEntry[]) {
  const entries: HistoryEntry[] = jobs.map(({ job, snapshot, finding_summary }) => ({
    id: job.id, repositoryId: Number(snapshot.repository_id), number: snapshot.url.split("/").at(-1) || "",
    createdAt: job.created_at, head: snapshot.head, status: job.status, summary: finding_summary,
  }));
  const byId = new Map([...additional, ...entries].map(entry => [entry.id, entry]));
  const time = (entry: HistoryEntry) => {
    const value = Date.parse(entry.createdAt);
    return Number.isFinite(value) ? value : -Infinity;
  };
  return [...byId.values()].sort((a, b) => time(b) - time(a) || b.id.localeCompare(a.id));
}
