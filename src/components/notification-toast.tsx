"use client";

import { Portal, Toast } from "radix-ui";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, Sparkles, X } from "lucide-react";
import styles from "./notification-toast.module.css";

type ToastAction = { label: string; onClick: () => void };
export type ToastMessage = { id: number; tone: "success" | "error" | "info" | "celebration"; message: string; action?: ToastAction };
type Notifications = {
  notify: (tone: ToastMessage["tone"], message: string, action?: ToastAction) => number;
  clearToast: () => void;
  dismiss: (id: number) => void;
};
const NotificationContext = createContext<Notifications | null>(null);

// One application-wide viewport keeps concurrent results visible without overlapping outlets.
export function NotificationProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const sequence = useRef(0);
  const notify = useCallback<Notifications["notify"]>((tone, message, action) => {
    const id = ++sequence.current;
    setToasts(previous => [...previous, { id, tone, message, action }]);
    return id;
  }, []);
  const clearToast = useCallback(() => setToasts([]), []);
  const dismiss = useCallback((id: number) => setToasts(previous => previous.filter(toast => toast.id !== id)), []);
  const value = useMemo(() => ({ notify, clearToast, dismiss }), [notify, clearToast, dismiss]);
  return <NotificationContext.Provider value={value}>{children}<ToastOutlet toasts={toasts} onDismiss={dismiss} /></NotificationContext.Provider>;
}

export function useNotifications() {
  const notifications = useContext(NotificationContext);
  if (!notifications) throw new Error("Notifications require a NotificationProvider.");
  return notifications;
}

// User-triggered validation and clipboard results need a new identity even when the text repeats.
// Polling state deliberately uses ordinary useState so a repeated background failure stays quiet.
export function useNotificationMessage(initial = "") {
  const [result, setResult] = useState({ message: initial, revision: 0 });
  const setMessage = useCallback((message: string) => {
    setResult(previous => ({ message, revision: previous.revision + (message ? 1 : 0) }));
  }, []);
  return [result.message, setMessage, result.revision] as const;
}

// A state-backed result can keep controlling retry/empty UI without rendering its message inline.
// Each mounted result is announced once; changes and retries can supply a fresh notificationKey.
export function Notification({ message, tone = "info", action, notificationKey }: {
  message: string | null | undefined; tone?: ToastMessage["tone"]; action?: ToastAction; notificationKey?: string | number;
}) {
  const context = useContext(NotificationContext);
  const notify = context?.notify, dismiss = context?.dismiss;
  const actionRef = useRef(action);
  useEffect(() => { actionRef.current = action; }, [action]);
  const label = action?.label;
  useEffect(() => {
    if (!message || !notify || !dismiss) return;
    const id = notify(tone, message, label ? { label, onClick: () => actionRef.current?.onClick() } : undefined);
    return () => dismiss(id);
  }, [message, tone, notificationKey, label, notify, dismiss]);
  // Standalone error boundaries can render even when the root layout failed.
  return !context && message ? <ToastOutlet toasts={[{ id: 0, tone, message, action }]} /> : null;
}

// Backwards-compatible bridge for explicit per-action messages, including sign-in.
export function NotificationToast({ toast }: { toast: ToastMessage | null }) {
  return <Notification message={toast?.message} tone={toast?.tone} action={toast?.action} notificationKey={toast?.id} />;
}

function ToastOutlet({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss?: (id: number) => void }) {
  const [container, setContainer] = useState<Element | undefined>();
  useEffect(() => {
    let active = true;
    const synchronize = () => {
      if (!active) return;
      // Only native dialogs require a top-layer host. Radix content uses transforms,
      // which would anchor the fixed viewport to the modal instead of the screen.
      const dialogs = document.querySelectorAll('dialog[open]');
      const current = dialogs.item(dialogs.length - 1) || undefined;
      setContainer(previous => previous === current ? previous : current);
    };
    const observer = new MutationObserver(synchronize);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["open"] });
    void Promise.resolve().then(synchronize);
    return () => { active = false; observer.disconnect(); };
  }, []);
  return <Toast.Provider swipeDirection="right">
    {toasts.map(toast => {
      const error = toast.tone === "error";
      return <Toast.Root key={toast.id} className={styles.toast} data-tone={toast.tone} type={error ? "foreground" : "background"} duration={error ? Infinity : toast.tone === "celebration" ? 9000 : 5000} onOpenChange={open => { if (!open) onDismiss?.(toast.id); }}>
        {error ? <CircleAlert className={styles.icon} size={16} aria-hidden="true" /> : toast.tone === "info" ? <Info className={styles.icon} size={16} aria-hidden="true" /> : toast.tone === "celebration" ? <Sparkles className={styles.icon} size={24} aria-hidden="true" /> : <CircleCheck className={styles.icon} size={16} aria-hidden="true" />}
        <div className={styles.body}>
          <Toast.Description className={styles.message}>{toast.message}</Toast.Description>
          {toast.action && <Toast.Action className={styles.action} altText={toast.action.label} onClick={toast.action.onClick}>{toast.action.label}</Toast.Action>}
        </div>
        <Toast.Close className={styles.close} aria-label="Dismiss notification"><X size={16} aria-hidden="true" /></Toast.Close>
      </Toast.Root>;
    })}
    <Portal.Root container={container}><Toast.Viewport className={styles.viewport} /></Portal.Root>
  </Toast.Provider>;
}
