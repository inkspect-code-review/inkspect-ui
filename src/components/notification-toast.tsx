"use client";

import { Toast } from "@base-ui/react/toast";
import { Toaster } from "./ui/toast";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

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
  return <Toast.Provider><Notifications>{children}</Notifications><Toaster /></Toast.Provider>;
}

function Notifications({ children }: { children: ReactNode }) {
  const { add, close } = Toast.useToastManager();
  const sequence = useRef(0);
  const notify = useCallback<Notifications["notify"]>((tone, message, action) => {
    const id = ++sequence.current;
    add({
      id: String(id), type: tone, title: message,
      timeout: tone === "error" ? 0 : tone === "celebration" ? 9000 : 5000,
      priority: tone === "error" ? "high" : "low",
      actionProps: action && { children: action.label, onClick: () => { close(String(id)); action.onClick(); } },
    });
    return id;
  }, [add, close]);
  const clearToast = useCallback(() => close(), [close]);
  const dismiss = useCallback((id: number) => close(String(id)), [close]);
  const value = useMemo(() => ({ notify, clearToast, dismiss }), [notify, clearToast, dismiss]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
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
  return !context && message ? <NotificationProvider><Notification {...{ tone, message, action, notificationKey }} /></NotificationProvider> : null;
}

// Backwards-compatible bridge for explicit per-action messages, including sign-in.
export function NotificationToast({ toast }: { toast: ToastMessage | null }) {
  return <Notification message={toast?.message} tone={toast?.tone} action={toast?.action} notificationKey={toast?.id} />;
}
