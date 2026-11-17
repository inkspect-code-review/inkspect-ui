"use client";

import { useRef, useState, type ReactElement, type ReactNode, type RefObject } from "react";
import { AlertDialog } from "radix-ui";
import styles from "./confirmation-dialog.module.css";

export function ConfirmationDialog({ open, onOpenChange, title, description, confirmLabel, busy = false, onConfirm, trigger, restoreFocusRef }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  trigger?: ReactElement;
  restoreFocusRef?: RefObject<HTMLElement | null>;
}) {
  const [container, setContainer] = useState<HTMLElement | undefined>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  return <AlertDialog.Root open={open} onOpenChange={next => {
    if (busy) return;
    if (next) {
      const active = triggerRef.current ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      returnFocus.current = active;
      // A confirmation opened within a native modal must remain in its top-layer subtree.
      setContainer(active?.closest<HTMLDialogElement>("dialog[open]") ?? undefined);
    }
    onOpenChange(next);
  }}>
    {trigger && <AlertDialog.Trigger asChild ref={triggerRef}>{trigger}</AlertDialog.Trigger>}
    <AlertDialog.Portal container={container}>
      <AlertDialog.Overlay className={styles.overlay} />
      <AlertDialog.Content className={styles.dialog} aria-busy={busy}
        onEscapeKeyDown={event => { event.preventDefault(); if (!busy) onOpenChange(false); }}
        onCloseAutoFocus={event => {
          const target = restoreFocusRef?.current ?? returnFocus.current;
          if (!target?.isConnected) return;
          const focus = target.matches(":disabled") ? target.closest<HTMLElement>("[tabindex]") : target;
          if (focus) { event.preventDefault(); focus.focus({ preventScroll: true }); }
        }}>
        <AlertDialog.Title className={styles.title}>{title}</AlertDialog.Title>
        <AlertDialog.Description className={styles.description}>{description}</AlertDialog.Description>
        <div className={styles.actions}>
          <AlertDialog.Cancel className={styles.secondary} disabled={busy}>Cancel</AlertDialog.Cancel>
          <AlertDialog.Action className={styles.danger} disabled={busy} aria-label={busy ? "Please wait…" : confirmLabel}
            onClick={event => { event.preventDefault(); if (!busy) onConfirm(); }}>
            <span className={styles.buttonLabel} data-busy={busy} aria-hidden="true"><span>{confirmLabel}</span><span>Please wait…</span></span>
          </AlertDialog.Action>
        </div>
      </AlertDialog.Content>
    </AlertDialog.Portal>
  </AlertDialog.Root>;
}
