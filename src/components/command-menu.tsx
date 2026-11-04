"use client";

import { useDashboardEdition } from "./dashboard-edition";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Command } from "cmdk";
import { Dialog } from "radix-ui";
import { Search, X } from "lucide-react";
import { type DashboardSection } from "@inkspect/core/lib/dashboard";
import { DashboardIcon } from "./dashboard-icon";
import styles from "./command-menu.module.css";

export function CommandMenu({ section, homeHref }: { section: DashboardSection; homeHref: string }) {
  const { sections: dashboardSections } = useDashboardEdition();
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!event.defaultPrevented && !event.repeat && !event.isComposing && !event.altKey && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        // Leave other modal dialogs in control of their own focus.
        if (!open && document.querySelector('dialog[open], [role="dialog"][data-state="open"]')) return;
        event.preventDefault();
        event.stopPropagation();
        setOpen((current) => !current);
      }
    }
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open]);

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <Dialog.Trigger asChild><button type="button" className={styles.trigger} aria-label="Open command menu" aria-keyshortcuts="Meta+k Control+k" title="Search pages (⌘K / Ctrl+K)"><Search size={16} /><span>Search</span><kbd>⌘K</kbd></button></Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Overlay className={styles.overlay} />
      <Dialog.Content className={styles.dialog}>
        <Dialog.Title className={styles.srOnly}>Go to a workspace page</Dialog.Title>
        <Dialog.Description className={styles.srOnly}>Search pages, use the arrow keys to move, and press Enter to open a page.</Dialog.Description>
        <Command label="Workspace pages" loop>
          <div className={styles.search}><Search size={20} aria-hidden="true" /><Command.Input data-slot="command-input" placeholder="Where do you want to go?" aria-label="Search workspace pages" className={styles.input} /><Dialog.Close className={styles.close} aria-label="Close command menu"><X size={18} /></Dialog.Close></div>
          <Command.List className={styles.list}>
            <Command.Empty className={styles.empty}>No pages found. Try another name.</Command.Empty>
            <Command.Group heading="Workspace pages" className={styles.group}>
              {dashboardSections.map((item) => <Command.Item key={item.id} value={item.id} keywords={[item.name, item.description]} className={styles.item} onSelect={() => { setOpen(false); router.push(item.id === "dashboard" ? homeHref : `/dashboard?view=${item.id}`); }}>
                <DashboardIcon name={item.id} /><span><strong>{item.name}</strong><small>{item.description}</small></span>{section === item.id && <span className={styles.current}>Current</span>}
              </Command.Item>)}
            </Command.Group>
          </Command.List>
        </Command>
        <div className={styles.footer}><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>↵</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
