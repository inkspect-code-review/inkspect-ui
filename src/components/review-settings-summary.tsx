"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { DashboardIcon } from "./dashboard-icon";
import { checkThresholdLabels, loadReviewSettings, saveReviewSetting, type ReviewSettings } from "./review-settings-data";
import { Switch } from "./ui/switch";
import { Notification, useNotificationMessage } from "./notification-toast";
import shared from "./dashboard.module.css";
import styles from "./dashboard-overview.module.css";

export function ReviewSettingsSummary({ organizationId }: { organizationId: string }) {
  const [settings, setSettings] = useState<ReviewSettings | null>(null);
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const pendingSave = useRef(false);
  const [error, setError, errorKey] = useNotificationMessage("");
  useEffect(() => {
    const controller = new AbortController();
    loadReviewSettings(organizationId, controller.signal).then(value => {
      if (!controller.signal.aborted) setSettings(value);
    }).catch(() => {
      if (!controller.signal.aborted) setFailed(true);
    });
    return () => controller.abort();
  }, [organizationId]);

  async function toggle(field: "automatic" | "auto_fix", checked: boolean) {
    if (!settings?.can_manage || pendingSave.current) return;
    pendingSave.current = true;
    setSaving(true);
    setError("");
    try {
      setSettings(await saveReviewSetting(organizationId, field, checked));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save automatic review settings.");
    } finally {
      pendingSave.current = false;
      setSaving(false);
    }
  }

  const pending = failed ? "Unavailable" : "Loading…";
  return <section aria-labelledby="dashboard-review-settings">
    <h2 id="dashboard-review-settings">Review settings</h2>
    <dl className={styles.reviewSettings} aria-busy={saving || (!settings && !failed)}>
      {([["automatic", "Automatic reviews"], ["auto_fix", "Auto fix"]] as const).map(([field, label]) =>
        <div key={field}>
          <dt><label htmlFor={`dashboard-${field}`}>{label}</label></dt>
          <dd className={styles.reviewSettingToggle}>{settings ? <>
            {settings[field] ? "On" : "Off"}
            <Switch id={`dashboard-${field}`} checked={settings[field]} disabled={!settings.can_manage || saving}
              onCheckedChange={checked => void toggle(field, checked)} />
          </> : pending}</dd>
        </div>
      )}
      <div><dt>Failure threshold</dt><dd>{settings ? checkThresholdLabels[settings.check_threshold] ?? "Unavailable" : pending}</dd></div>
    </dl>
    <Link className={`${shared.primaryButton} w-full`} href="/dashboard?view=settings">
      View all settings<DashboardIcon name="arrow" />
    </Link>
    <Notification message={error} tone="error" notificationKey={errorKey} />
  </section>;
}
