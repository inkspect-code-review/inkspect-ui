"use client";

import { useState } from "react";
import { type UsageDay, usageNumber } from "@inkspect/core/lib/usage/usage-display";
import styles from "./usage.module.css";

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const date = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });

export function UsageChart({ daily, loading }: { daily: UsageDay[] | undefined; loading: boolean }) {
  const [activeDay, setActiveDay] = useState<string | null>(null);
  const active = daily?.find(row => row.day === activeDay);
  const peak = Math.max(1, ...(daily ?? []).flatMap(row => [Number(row.input_tokens), Number(row.output_tokens)]));
  const magnitude = 10 ** Math.floor(Math.log10(peak));
  const ceiling = Math.ceil(peak / magnitude) * magnitude;
  const labelEvery = Math.max(1, Math.ceil(((daily?.length ?? 1) - 1) / 6));
  const isEmpty = daily?.every(row => row.input_tokens === "0" && row.output_tokens === "0");

  return <section className={styles.chart} aria-label="Daily input and output tokens" aria-busy={loading}>
    <div className={styles.chartHeading}>
      <h2>Token usage</h2>
      <div className={styles.chartLegend}>
        <span><i className={styles.inputSwatch} />Input</span>
        <span><i className={styles.outputSwatch} />Output</span>
      </div>
    </div>
    {!daily ? <p className={styles.chartEmpty}>{loading ? "Loading usage…" : "—"}</p> : <>
      <div className={styles.chartBody}>
        <div className={styles.chartAxis} aria-hidden="true">
          {[1, 0.5, 0].map(ratio => <span key={ratio}>{compact.format(ceiling * ratio)}</span>)}
        </div>
        <div className={styles.chartScroll}>
          <div className={styles.chartPlot} style={{ minWidth: Math.max(280, daily.length * 18) }}>
            <div className={styles.chartGrid} aria-hidden="true"><span /><span /><span /></div>
            <div className={styles.chartColumns}>
              {daily.map((row, index) => {
                const label = `${date(row.day)} (UTC) · Input ${usageNumber(row.input_tokens)} · Output ${usageNumber(row.output_tokens)}`;
                const showDate = (index % labelEvery === 0 && index <= daily.length - 1 - labelEvery) || index === daily.length - 1;
                return <div key={row.day} className={styles.chartColumn} role="img" aria-label={label}
                  tabIndex={Number(row.input_tokens) > 0 || Number(row.output_tokens) > 0 ? 0 : undefined}
                  onMouseEnter={() => setActiveDay(row.day)} onMouseLeave={() => setActiveDay(null)}
                  onFocus={() => setActiveDay(row.day)} onBlur={() => setActiveDay(null)}>
                  <div className={styles.chartBars} aria-hidden="true">
                    <span className={styles.inputBar} style={{ height: `${Number(row.input_tokens) / ceiling * 100}%` }} />
                    <span className={styles.outputBar} style={{ height: `${Number(row.output_tokens) / ceiling * 100}%` }} />
                  </div>
                  {showDate && <span className={styles.chartDate} aria-hidden="true">{date(row.day)}</span>}
                </div>;
              })}
            </div>
            {isEmpty && <p className={styles.chartNoTokens}>No token usage for this period.</p>}
          </div>
        </div>
      </div>
      <p className={styles.chartReadout}>{active
        ? `${date(active.day)} · Input ${usageNumber(active.input_tokens)} · Output ${usageNumber(active.output_tokens)}`
        : "Daily tokens · UTC"}</p>
    </>}
  </section>;
}
