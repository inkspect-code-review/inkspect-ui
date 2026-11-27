import { productFetch } from "@inkspect/core/lib/api-client";

export const checkThresholdLabels = {
  P0: "Critical only",
  P1: "High and critical",
  P2: "Medium and above",
  P3: "All findings",
};

export type ReviewSettings = {
  automatic: boolean;
  auto_fix: boolean;
  ignored_authors: string[];
  check_threshold: keyof typeof checkThresholdLabels;
  diagram_direction: "TD" | "LR";
  can_manage: boolean;
};

const reviewSettingsURL = (organizationId: string) =>
  `/api/review-settings?${new URLSearchParams({ organizationId })}`;

export async function loadReviewSettings(organizationId: string, signal?: AbortSignal): Promise<ReviewSettings> {
  const response = await productFetch(reviewSettingsURL(organizationId), { signal, cache: "no-store" });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not load automatic review settings.");
  return data;
}

export async function saveReviewSetting<K extends Exclude<keyof ReviewSettings, "can_manage">>(
  organizationId: string, field: K, value: ReviewSettings[K],
): Promise<ReviewSettings> {
  const response = await productFetch(reviewSettingsURL(organizationId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ [field]: value }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Could not save automatic review settings.");
  return data;
}
