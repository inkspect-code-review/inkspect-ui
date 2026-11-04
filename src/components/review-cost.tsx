"use client";
import type { ReviewCost } from "@inkspect/core/lib/review-cost";
import { useDashboardEdition } from "./dashboard-edition";
import styles from "./reviews.module.css";

const usd = (value: string) => `$${BigInt(value) / 1000000000n}.${(BigInt(value) % 1000000000n).toString().padStart(9, "0").replace(/0{1,3}$/, "")}`;
const summaryUsd = (value: string) => BigInt(value) > 0n && BigInt(value) < 100000n ? "<$0.0001" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(Number(value) / 1e9);
const labels = { model: 'Review model', embedding: 'Embedding', rerank: 'Rerank' };
export function ReviewCostView({ cost }: { cost?: ReviewCost }) {
  const edition = useDashboardEdition();
  if (!cost) return <p className={styles.costNote}>Provider cost breakdown was not recorded for this review.</p>;
  return <details className={styles.costBreakdown}>
    <summary>Provider cost <span className={styles.costSummary}>{cost.complete && cost.total_nano_usd !== null ? summaryUsd(cost.total_nano_usd) : `${summaryUsd(cost.measured_nano_usd)} measured (partial)`}</span></summary>
    <p className={styles.costNote}>{edition.providerCostNote}</p>
    <dl className={styles.costRows}>{cost.components.map(c => <div key={c.category}><dt>{labels[c.category]} <small>({c.calls} calls)</small></dt><dd>{c.complete && c.cost_nano_usd !== null ? usd(c.cost_nano_usd) : <>{usd(c.measured_nano_usd)} measured{c.estimated_nano_usd !== '0' && <> + at least ~{usd(c.estimated_nano_usd)} estimated</>}</>}</dd></div>)}</dl>
    {cost.estimated_nano_usd !== '0' && <p className={styles.costNote}>Measured cost + minimum rerank estimate: {usd((BigInt(cost.measured_nano_usd) + BigInt(cost.estimated_nano_usd)).toString())}. Rerank may bill additional document chunks.</p>}
    {cost.unmeasured_calls > 0 && <p className={styles.costNote}>{cost.unmeasured_calls} calls have no complete usage or price measurement. They are not counted as free.</p>}
  </details>;
}
