"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Bell, Monitor } from "lucide-react";
import { authClient } from "@inkspect/core/lib/auth-client";
import { productFetch } from "@inkspect/core/lib/api-client";
import { ConfirmationDialog } from "../components/confirmation-dialog";
import { useNotifications } from "../components/notification-toast";
import type { SettingsSection } from "../components/settings-workspace";
import { Switch } from "../components/ui/switch";
import styles from "../components/settings.module.css";
import buttons from "../components/dashboard.module.css";

export function ProfileName({ name }: { name: string }) {
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const { notify } = useNotifications();
  const router = useRouter();
  async function save(event: FormEvent) {
    event.preventDefault();
    const value = draft.trim();
    if (!value || value.length > 100 || Array.from(value).some(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127)) {
      notify("error", "Enter a display name of 1 to 100 characters without control characters.");
      return;
    }
    setSaving(true);
    try {
      const result = await authClient.updateUser({ name: value });
      if (result.error) throw new Error();
      setDraft(value);
      notify("success", "Display name updated.");
      router.refresh();
    } catch { notify("error", "Could not save your display name. Try again."); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className={styles.row}>
    <div className={styles.fieldDescription}><label htmlFor="display-name">Display name</label></div>
    <div className={styles.field}><input id="display-name" className={styles.input} value={draft}
      onChange={e => setDraft(e.target.value)} required maxLength={100} autoComplete="name" disabled={saving} />
      <div className={styles.authorActions}><button className={buttons.primaryButton} disabled={saving || draft.trim() === name}>Save name</button></div>
    </div>
  </form>;
}

async function accountRequest<T>(path: string, body?: object, signal?: AbortSignal): Promise<T> {
  const response = await productFetch(path, {
    cache: "no-store", signal,
    ...(body && { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Could not complete this request.");
  return result;
}

function useAccountData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [failed, setFailed] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void accountRequest<T>(path, undefined, controller.signal)
      .then(value => { if (!controller.signal.aborted) { setData(value); setFailed(false); } })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => controller.abort();
  }, [path, revision]);
  const status = failed ? <p role="alert">Could not load these settings. <button className={buttons.secondaryButton}
    onClick={() => { setFailed(false); setRevision(n => n + 1); }}>Retry</button></p> : <p role="status">Loading…</p>;
  return { data, setData, status };
}

type Preferences = { product: boolean; transactional: boolean };
const preferencesPath = "/api/account/notifications";

function EmailPreferences() {
  const { data, setData, status } = useAccountData<Preferences>(preferencesPath);
  const [saving, setSaving] = useState(false);
  const { notify } = useNotifications();
  async function update(category: keyof Preferences, enabled: boolean) {
    setSaving(true);
    try {
      setData(await accountRequest<Preferences>(preferencesPath, { category, enabled }));
      notify("success", "Email preference saved.");
    } catch { notify("error", "Could not save this preference. Try again."); }
    finally { setSaving(false); }
  }
  return <section className={styles.section}><header className={styles.sectionHeader}><div><h2>Email notifications</h2>
    <p>Choose emails for this account. Sign-in and security emails are always enabled.</p></div></header>
    {data ? (["product", "transactional"] as const).map(category => <div className={styles.row} key={category}>
      <div className={styles.fieldDescription}><label htmlFor={category + "-emails"}>{category === "product" ? "Product updates" : "Transactional emails"}</label></div>
      <Switch id={category + "-emails"} checked={data[category]} disabled={saving} onCheckedChange={enabled => void update(category, enabled)} />
    </div>) : status}
  </section>;
}

type Device = { id: string; current: boolean; userAgent: string | null; ipAddress: string | null; createdAt: string };
const devicesPath = "/api/account/devices";
function deviceName(agent: string | null) {
  if (!agent) return "Unknown device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox|FxiOS/.test(agent) ? "Firefox" : /Chrome|CriOS/.test(agent) ? "Chrome" : /Safari/.test(agent) ? "Safari" : "Browser";
  const platform = /iPhone|iPad/.test(agent) ? "iOS" : /Android/.test(agent) ? "Android" : /Macintosh/.test(agent) ? "macOS" : /Windows/.test(agent) ? "Windows" : /Linux/.test(agent) ? "Linux" : "";
  return platform ? browser + " on " + platform : browser;
}

function Devices() {
  const { data, setData, status } = useAccountData<Device[]>(devicesPath);
  const [target, setTarget] = useState<Device | "others" | null>(null);
  const [busy, setBusy] = useState(false);
  const { notify } = useNotifications();
  async function revoke() {
    if (!target || busy) return;
    setBusy(true);
    try {
      await accountRequest(devicesPath, target === "others" ? { others: true } : { id: target.id });
      setData(previous => previous?.filter(device => target === "others" ? device.current : device.id !== target.id) ?? null);
      setTarget(null);
      notify("success", "Selected devices signed out.");
    } catch { notify("error", "Could not sign out the device. Refresh and try again."); }
    finally { setBusy(false); }
  }
  return <section className={styles.section}><header className={styles.sectionHeader}><div><h2>Signed-in devices</h2>
    <p>Manage active sessions for your account.</p></div></header>
    {data ? <>{data.map(device => <div key={device.id} className={styles.row}>
      <div className={styles.fieldDescription}><h3>{deviceName(device.userAgent)}{device.current && " · This device"}</h3>
        <p>Signed in {new Date(device.createdAt).toLocaleString()}{device.ipAddress && " · " + device.ipAddress}</p></div>
      {!device.current && <ConfirmationDialog open={typeof target === "object" && target?.id === device.id} onOpenChange={open => setTarget(open ? device : null)}
        trigger={<button className={buttons.secondaryButton}>Sign out device</button>} title="Sign out this device?"
        description={deviceName(device.userAgent) + " will need to sign in again."} confirmLabel="Sign out device" busy={busy} onConfirm={() => void revoke()} />}
    </div>)}
    {data.some(device => !device.current) && <ConfirmationDialog open={target === "others"} onOpenChange={open => setTarget(open ? "others" : null)}
      trigger={<button className={buttons.secondaryButton}>Sign out other devices</button>} title="Sign out all other devices?"
      description="Only this session will stay signed in." confirmLabel="Sign out other devices" busy={busy} onConfirm={() => void revoke()} />}
    </> : status}
  </section>;
}

export const accountSections: SettingsSection[] = [
  { id: "devices", label: "Devices", description: "Manage signed-in devices", icon: Monitor, content: <Devices /> },
  { id: "notifications", label: "Notifications", description: "Email preferences", icon: Bell, content: <EmailPreferences /> },
];
