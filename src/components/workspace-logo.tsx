"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DashboardOrganization } from "@inkspect/core/lib/dashboard";
import { workspaceLogoMaxBytes, workspaceLogoSource, workspaceLogoTypes } from "@inkspect/core/lib/workspace-logo";
import { WorkspaceAvatar } from "./workspace-avatar";
import { useNotifications } from "./notification-toast";
import settings from "./settings.module.css";
import shared from "./dashboard.module.css";
import styles from "./workspace-logo.module.css";

export function WorkspaceLogo({ organization, canManage, uploadsEnabled }: { organization: DashboardOrganization; canManage: boolean; uploadsEnabled: boolean }) {
  const router = useRouter();
  const { notify, clearToast } = useNotifications();
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const [logo, setLogo] = useState(organization.logo);
  const [busy, setBusy] = useState(false);
  const [refreshing, startTransition] = useTransition();
  const disabled = busy || refreshing || !uploadsEnabled;
  const hasLogo = !!workspaceLogoSource(organization.id, logo);

  async function update(file?: File) {
    if (pending.current || !canManage || disabled) return;
    clearToast();
    if (file && !workspaceLogoTypes.some(type => type === file.type)) { notify("error", "Choose a PNG, JPEG or WebP image."); return; }
    if (file && file.size > workspaceLogoMaxBytes) { notify("error", "Choose an image smaller than 2 MB."); return; }
    pending.current = true;
    setBusy(true);
    try {
      // This authenticated asset route lives on Next.js, like the auth routes.
      const response = await fetch(`/api/workspace-logo?${new URLSearchParams({ organizationId: organization.id })}`, {
        method: file ? "POST" : "DELETE", credentials: "same-origin",
        ...(file ? { headers: { "Content-Type": file.type }, body: file } : {}),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Couldn’t update the logo. Please try again.");
      setLogo(result.logo);
      notify("success", file ? "Workspace logo updated." : "Workspace logo removed.");
      startTransition(() => router.refresh());
    } catch (error) { notify("error", error instanceof Error ? error.message : "Couldn’t update the logo. Please try again."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <div className={settings.row} aria-busy={busy || refreshing}>
    <div className={settings.fieldDescription}><h3>Workspace logo</h3><p>Shown in your workspace selector.</p></div>
    <div className={settings.field}>
      <div className={styles.controls}>
        <WorkspaceAvatar organization={{ ...organization, logo }} className={styles.preview} />
        {canManage && <div className={styles.actions}>
          <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden disabled={disabled} aria-label="Choose workspace logo" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void update(file); }} />
          <button type="button" className={shared.secondaryButton} disabled={disabled} onClick={() => input.current?.click()}>{busy ? "Updating…" : hasLogo ? "Change logo" : "Upload logo"}</button>
          {hasLogo && <button type="button" className={styles.remove} disabled={disabled} onClick={() => void update()}>Remove</button>}
        </div>}
      </div>
      <p className={settings.hint}>{!canManage ? "Only workspace owners and admins can change the logo." : !uploadsEnabled ? "Logo uploads are not available yet." : "PNG, JPEG or WebP. Maximum 2 MB."}</p>
    </div>
  </div>;
}
