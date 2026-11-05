"use client";
import { useEffect, useState } from "react";
import { productFetch } from "@inkspect/core/lib/api-client";

type Props = {
  title?: string; organizationId?: string; repositoryId?: number | string; number?: number | string | null;
  fallback?: string; className?: string;
};

export function ReviewPullTitle({ title, organizationId, repositoryId, number, fallback, className }: Props) {
  const query = !title && organizationId && repositoryId && number
    ? new URLSearchParams({ organizationId, repositoryId: String(repositoryId), number: String(number), action: "pull-title" }).toString()
    : undefined;
  const [resolved, setResolved] = useState<{ query: string; title: string }>();
  useEffect(() => {
    if (!query) return;
    const controller = new AbortController();
    async function load(key: string) {
      try {
        const response = await productFetch(`/api/reviews?${key}`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const result = await response.json();
        if (!controller.signal.aborted && typeof result.title === "string") setResolved({ query: key, title: result.title.trim() });
      } catch { /* Older saved reviews remain readable when GitHub is unavailable. */ }
    }
    void load(query);
    return () => controller.abort();
  }, [query]);
  const text = title || (resolved && resolved.query === query && resolved.title) || fallback;
  return text ? <span className={className} title={className ? text : undefined}>{text}</span> : null;
}
