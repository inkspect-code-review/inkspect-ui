"use client";

import { useRef, useState, type ReactNode } from "react";
import { Command } from "cmdk";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { Popover } from "radix-ui";
import { searchByText } from "@inkspect/core/lib/repository-search";
import styles from "./searchable-select.module.css";

export type SearchableOption = { value: string; label: string; disabled?: boolean; group?: string };

type Props = {
  id: string;
  label: string;
  value: string;
  options: SearchableOption[];
  onValueChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  disabled?: boolean;
  footer?: ReactNode;
  /** Extra trigger class, so a form can match the trigger to its other fields. */
  className?: string;
  /** For very long lists: filter here and render at most this many matches, with a hint to keep typing. */
  limit?: number;
};

export function SearchableSelect({ id, label, value, options, onValueChange, placeholder, searchPlaceholder, emptyMessage, disabled, footer, className, limit }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = options.find((option) => option.value === value);
  const limited = limit ? searchByText(options, query, (option) => option.label, limit) : null;
  const shown = limited?.matches ?? options;
  const groups = [...new Set(shown.map(option => option.group || ""))];
  const hidden = limited ? limited.total - limited.matches.length : 0;
  const close = () => { setOpen(false); setQuery(""); };

  return <Popover.Root open={open && !disabled} onOpenChange={(next) => next ? setOpen(true) : close()}>
    <Popover.Trigger asChild>
      <button id={id} type="button" className={className ? `${styles.trigger} ${className}` : styles.trigger} disabled={disabled} aria-label={`${label}: ${selected?.label ?? placeholder}`}>
        <span>{selected?.label ?? placeholder}</span><ChevronsUpDown size={15} aria-hidden="true" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content className={styles.content} align="start" sideOffset={6} collisionPadding={16} aria-label={label} onOpenAutoFocus={(event) => { event.preventDefault(); inputRef.current?.focus(); }}>
        <Command label={label} defaultValue={value} loop shouldFilter={!limited}>
          <div className={styles.search}><Search size={16} aria-hidden="true" /><Command.Input ref={inputRef} data-slot="command-input" placeholder={searchPlaceholder} aria-label={searchPlaceholder} className={styles.input} {...(limited ? { value: query, onValueChange: setQuery } : {})} /></div>
          <Command.List className={styles.list}>
            <Command.Empty className={styles.empty}>{emptyMessage}</Command.Empty>
            {groups.map(group => <Command.Group key={group} heading={group || undefined}>
            {shown.filter(option => (option.group || "") === group).map((option) => <Command.Item key={option.value} value={option.value} keywords={[option.label, group]} disabled={option.disabled} className={styles.option} onSelect={() => { onValueChange(option.value); close(); }}>
              <span>{option.label}</span>{option.value === value && <Check size={16} aria-label="Selected" />}
            </Command.Item>)}
            </Command.Group>)}
          </Command.List>
        </Command>
        {(footer || hidden > 0) && <div className={styles.footer}>
          {hidden > 0 && <p role="status">Showing {limited!.matches.length} of {limited!.total.toLocaleString()}. Keep typing to narrow the list.</p>}
          {footer}
        </div>}
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>;
}
