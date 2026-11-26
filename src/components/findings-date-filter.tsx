"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { CalendarRange, X } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { useIsMobile } from "../hooks/use-mobile";
import type { FindingsPeriod } from "./findings-date-range";
import styles from "./findings.module.css";

function localDate(value?: Date) {
  if (!value) return "";
  return [value.getFullYear(), String(value.getMonth() + 1).padStart(2, "0"), String(value.getDate()).padStart(2, "0")].join("-");
}

function RangeCalendar({ initialRange, onApply }: { initialRange?: DateRange; onApply: (period: FindingsPeriod) => void }) {
  const [range, setRange] = useState(initialRange);
  const mobile = useIsMobile();

  return <>
    <DayPicker mode="range" selected={range} onSelect={setRange} resetOnSelect
      defaultMonth={initialRange?.from ?? initialRange?.to} numberOfMonths={mobile ? 1 : 2} fixedWeeks
      className={styles.calendar} />
    <div className={styles.rangeFooter}>
      <div className={styles.rangeBounds} aria-live="polite">
        {(["from", "to"] as const).map(bound => {
          const value = range?.[bound];
          const label = bound === "from" ? "From" : "Through";
          return <div key={bound}><span>{label}</span>
            <strong>{value ? value.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Any date"}</strong>
            {value && <button type="button" aria-label={`Clear ${label.toLowerCase()} date`}
              onClick={() => setRange({ from: range?.from, to: range?.to, [bound]: undefined })}><X size={12} aria-hidden="true" /></button>}
          </div>;
        })}
      </div>
      <button type="button" className={styles.applyRange} onClick={() => onApply(range?.from || range?.to
        ? { from: localDate(range.from), to: localDate(range.to) } : "all")}>Apply range</button>
    </div>
  </>;
}

export function FindingsDateFilter({ period, onChange }: { period: FindingsPeriod; onChange: (period: FindingsPeriod) => void }) {
  const [open, setOpen] = useState(false);
  const custom = typeof period === "object";
  const label = custom ? [period.from && `From ${period.from}`, period.to && `through ${period.to}`].filter(Boolean).join(" ") : "Custom date range";
  const initialRange = custom ? {
    from: period.from ? new Date(`${period.from}T00:00:00`) : undefined,
    to: period.to ? new Date(`${period.to}T00:00:00`) : undefined,
  } : undefined;

  return <div className={styles.field}>
    <span id="review-date-label" className={styles.label}>Review date{custom && <span className={styles.rangeCaption}> · {label}</span>}</span>
    <div className={styles.period} role="group" aria-labelledby="review-date-label">
      {(["all", 7, 15, 30] as const).map(value => <button key={value} type="button"
        aria-label={value === "all" ? "All time" : `Last ${value} days`} aria-pressed={period === value}
        onClick={() => onChange(value)}>{value === "all" ? "All time" : `${value}d`}</button>)}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger type="button" aria-label={`Custom date range${custom ? `: ${label}` : ""}`} title={label} aria-pressed={custom}>
          <CalendarRange size={15} aria-hidden="true" />Custom
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner align="end" sideOffset={6} collisionPadding={12} className={styles.datePositioner}>
            <Popover.Popup aria-label="Custom review dates" className={styles.datePopover}>
              <RangeCalendar initialRange={initialRange} onApply={value => { onChange(value); setOpen(false); }} />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  </div>;
}
