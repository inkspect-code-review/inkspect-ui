"use client";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useChatWindow } from "./chat-window-provider";
import { useSidebar } from "./ui/sidebar";

const serverSnapshot = () => false;

export function useWorkspaceChatLayout(key: string) {
  const [saved, setWindow, restored] = useChatWindow(key);
  const { open: sidebarOpen } = useSidebar();
  // Reclaim the 184px saved when the 248px navigation collapses to its 64px rail.
  const query = sidebarOpen ? "(min-width: 1440px)" : "(min-width: 1256px)";
  const subscribe = useCallback((notify: () => void) => {
    const media = globalThis.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  }, [query]);
  const getSnapshot = useCallback(() => globalThis.matchMedia(query).matches, [query]);
  const wide = useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
  const canDock = restored && wide;
  const docked = canDock && saved.placement !== "window";
  const open = docked ? saved.panelOpen !== false : saved.open;
  // Carry automatic visibility across a resize in this session. Opening the
  // dashboard on a wide screen alone should not change the saved preference.
  useEffect(() => {
    if (docked && open && !saved.open) setWindow({ open: true }, false);
  }, [docked, open, saved.open, setWindow]);
  const setOpen = useCallback((open: boolean) => {
    setWindow({ panelOpen: open, open });
  }, [setWindow]);

  return { window: { ...saved, open, expanded: !docked && saved.expanded }, setWindow, setOpen, docked, canDock };
}
