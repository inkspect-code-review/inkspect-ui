"use client";
import { UsagePanel } from "../components/usage/usage-panel";
import type { DashboardMember } from "@inkspect/core/lib/dashboard";
import type { UsagePresentation } from "@inkspect/core/lib/usage/usage-display";
import { assertUsageHistoryResponse } from "@inkspect/core/lib/usage/usage-response";

const presentation: UsagePresentation = {
  amountLabel: "Provider cost",
  totalLabel: "Recorded provider cost",
  formatAmount: amount => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(Number(amount) / 1e9),
  note: "Provider costs show recorded measurements. Unmeasured operations are excluded from cost totals.",
  read(value, grouped) { assertUsageHistoryResponse(value, grouped); return value; },
};

export function SelfHostedUsagePanel(props: { organizationId: string; members: DashboardMember[] }) {
  return <UsagePanel {...props} presentation={presentation} />;
}
