import type { Repository } from "@inkspect/core/lib/github";

export const repositoryPageSize = 20;

export function matchingRepositories(repositories: Repository[], query: string, stars: Set<number>) {
  const search = query.trim().toLowerCase();
  return repositories.filter(repo => repo.fullName.toLowerCase().includes(search)).sort((a, b) =>
    Number(stars.has(b.id)) - Number(stars.has(a.id)) || a.fullName.localeCompare(b.fullName));
}

export function repositoryPage<T>(repositories: T[], page: number) {
  const pages = Math.max(1, Math.ceil(repositories.length / repositoryPageSize));
  const currentPage = Math.min(page, pages);
  const pageStart = (currentPage - 1) * repositoryPageSize;
  return { pages, currentPage, pageStart, pageRepositories: repositories.slice(pageStart, pageStart + repositoryPageSize) };
}

export function starredRepositories(repositories: Repository[], stars: Set<number>) {
  return repositories.filter(repo => stars.has(repo.id));
}

type Coverage = Record<string, "indexed" | "partial">;

export async function readIndexedIds(ids: string[], read: (batch: string[]) => Promise<Coverage>, signal: AbortSignal) {
  const indexed = new Set<number>();
  for (let offset = 0; offset < ids.length; offset += repositoryPageSize) {
    signal.throwIfAborted();
    const batch = ids.slice(offset, offset + repositoryPageSize);
    const coverage = await read(batch);
    for (const id of batch) {
      if (coverage[id] === "indexed" || coverage[id] === "partial") indexed.add(Number(id));
    }
  }
  return indexed;
}
