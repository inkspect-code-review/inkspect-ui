"use client";

import { Portal, Toast } from "radix-ui";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import styles from "./notification-toast.module.css";

export type ToastMessage = { id: number; tone: "success" | "error"; message: string };

// Shows one result at a time; a new id replaces the current toast. Success closes on its own,
// errors stay until dismissed so they can be read. Success is announced politely, errors assertively.
export function NotificationToast({ toast }: { toast: ToastMessage | null }) {
  const error = toast?.tone === "error";
  return <Toast.Provider swipeDirection="right">
    {toast && <Toast.Root key={toast.id} className={styles.toast} data-tone={toast.tone} type={error ? "foreground" : "background"} duration={error ? Infinity : 5000}>
      {error ? <CircleAlert className={styles.icon} size={16} aria-hidden="true" /> : <CircleCheck className={styles.icon} size={16} aria-hidden="true" />}
      <Toast.Description className={styles.message}>{toast.message}</Toast.Description>
      <Toast.Close className={styles.close} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></Toast.Close>
    </Toast.Root>}
    <Portal.Root><Toast.Viewport className={styles.viewport} /></Portal.Root>
  </Toast.Provider>;
}
