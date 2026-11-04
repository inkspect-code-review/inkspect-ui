"use client";

import { useSyncExternalStore } from "react";

const mobileQuery = "(max-width: 767px)";
function subscribe(onChange: () => void) {
  const query = window.matchMedia(mobileQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}
function getSnapshot() { return window.matchMedia(mobileQuery).matches; }
function getServerSnapshot() { return false; }

export function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
