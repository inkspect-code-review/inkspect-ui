"use client";

import { useState } from "react";
import { CalendarRange } from "lucide-react";
import { Popover } from "radix-ui";
import type { FindingsPeriod } from "./findings-date-range";
import styles from "./findings.module.css";

export function FindingsDateFilter({ period, onChange }: { period: FindingsPeriod; onChange: (period: FindingsPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const custom = typeof period === "object";
  const label = custom ? [period.from && `From ${period.from}`, period.to && `through ${period.to}`].filter(Boolean).join(" ") : "Custom date range";
  const invalid = Boolean(from && to && from > to);

  return <div className={styles.field}>
    <span id="review-date-label" className={styles.label}>Review date{custom && <span className={styles.rangeCaption}> · {label}</span>}</span>
    <div className={styles.period} role="group" aria-labelledby="review-date-label">
      {(["all", 7, 15, 30] as const).map(value => <button key={value} type="button"
        aria-label={value === "all" ? "All time" : `Last ${value} days`} aria-pressed={period === value}
        onClick={() => onChange(value)}>{value === "all" ? "All time" : `${value}d`}</button>)}
      <Popover.Root open={open} onOpenChange={next => {
        if (next) { setFrom(custom ? period.from : ""); setTo(custom ? period.to : ""); }
        setOpen(next);
      }}>
        <Popover.Trigger asChild>
          <button type="button" aria-label={`Custom date range${custom ? `: ${label}` : ""}`} title={label} aria-pressed={custom}><CalendarRange size={15} aria-hidden="true" />Custom</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="end" sideOffset={6} collisionPadding={12} aria-label="Custom review dates" className={styles.datePopover}>
            <form onSubmit={event => {
              event.preventDefault();
              if (invalid) return;
              onChange(from || to ? { from, to } : "all");
              setOpen(false);
            }}>
              <label>From<input data-slot="date-input" type="date" value={from} max={to || undefined} onChange={event => setFrom(event.target.value)} /></label>
              <label>Through<input data-slot="date-input" type="date" value={to} min={from || undefined} onChange={event => setTo(event.target.value)} /></label>
              {invalid && <span role="alert">Choose an end date on or after the start date.</span>}
              <button type="submit" disabled={invalid}>Apply range</button>
            </form>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  </div>;
}
