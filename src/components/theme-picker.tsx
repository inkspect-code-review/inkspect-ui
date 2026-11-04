"use client";

import { dashboardThemes } from "@inkspect/core/lib/theme";
import { useDashboardTheme } from "./theme-provider";
import { DashboardIcon } from "./dashboard-icon";
import shared from "./dashboard.module.css";
import settings from "./settings.module.css";
import styles from "./theme-picker.module.css";

export function ThemePicker() {
  const { theme, setTheme } = useDashboardTheme();
  return <section className={settings.section} aria-labelledby="theme-heading">
    <header className={settings.sectionHeader}><div><h2 id="theme-heading">Appearance</h2><p>Choose a theme. Your preference is saved in this browser.</p></div></header>
    <fieldset className={styles.themeFieldset}>
      <legend className={shared.visuallyHidden}>Choose your dashboard theme</legend>
      <div className={styles.themeOptions}>
        {dashboardThemes.map((option) => <label key={option.id} className={styles.themeOption} data-selected={theme === option.id}>
          <input className={shared.visuallyHidden} type="radio" aria-label={option.name} name="dashboard-theme" value={option.id} checked={theme === option.id} onChange={() => setTheme(option.id)} />
          <span className={styles.themePreview} data-dashboard-theme={option.id} aria-hidden="true">
            <span className={styles.previewSidebar}><span className={styles.previewBrand} /><span className={styles.previewSwitcher} /><span className={styles.previewActive} /><span className={styles.previewNav} /><span className={styles.previewNav} /></span>
            <span className={styles.previewWorkspace}><span className={styles.previewTopbar} /><span className={styles.previewContent}><span className={styles.previewTitle} /><span className={styles.previewPanel}><span /><span /><span /></span><span className={styles.previewButton} /></span></span>
          </span>
          <span className={styles.themeLabel}><strong>{option.name}</strong><span className={styles.themeSelected} aria-hidden="true">{theme === option.id && <DashboardIcon name="check" />}</span></span>
          <span className={styles.themeCaption}>{option.description}</span>
        </label>)}
      </div>
    </fieldset>
  </section>;
}
