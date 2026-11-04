"use client";

import { Portal, Toast } from "radix-ui";
import { X } from "lucide-react";
import styles from "./auth-cancellation-toast.module.css";

export function isAuthCancellation(message: string) {
  return /\bcancell?ed\b/i.test(message);
}

export function AuthCancellationToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <Toast.Provider duration={6000} swipeDirection="right">
    <Toast.Root className={styles.toast} defaultOpen onOpenChange={open => { if (!open) onDismiss(); }}>
      <Toast.Description className={styles.message}>{message}</Toast.Description>
      <Toast.Close className={styles.close} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></Toast.Close>
    </Toast.Root>
    <Portal.Root><Toast.Viewport className={styles.viewport} /></Portal.Root>
  </Toast.Provider>;
}
