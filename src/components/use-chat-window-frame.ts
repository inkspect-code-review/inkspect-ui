"use client";

import { useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import { usePathname } from "next/navigation";
import { adjustChatFrame, fitChatFrame, type ChatFrame, type WindowGesture } from "@inkspect/core/lib/chat-window-geometry";

const mobileQuery = "(max-width: 760px)";
export const isMobileChat = () => globalThis.matchMedia(mobileQuery).matches;
const subscribeMobile = (notify: () => void) => {
  const query = globalThis.matchMedia(mobileQuery);
  query.addEventListener("change", notify);
  return () => query.removeEventListener("change", notify);
};
const serverMobile = () => false;

function viewport() {
  const visual = globalThis.visualViewport;
  const width = document.documentElement.clientWidth || globalThis.innerWidth;
  const height = globalThis.innerHeight;
  if (visual?.scale !== 1) return { width, height };
  return { width: Math.min(width, visual.width || width), height: Math.min(height, visual.height || height) };
}

function subscribeViewport(notify: () => void) {
  globalThis.addEventListener("resize", notify);
  const visual = globalThis.visualViewport;
  visual?.addEventListener("resize", notify);
  return () => {
    globalThis.removeEventListener("resize", notify);
    visual?.removeEventListener("resize", notify);
  };
}

const viewportWidth = () => viewport().width;
const viewportHeight = () => viewport().height;
const noSize = () => 0;
const noSubscription = () => () => {};

export function useChatWindowFrame(frame: ChatFrame | null, expanded: boolean, open: boolean, update: (changes: { frame: ChatFrame }) => void) {
  const panel = useRef<HTMLElement>(null);
  const gesture = useRef<{ id: number; x: number; y: number; frame: ChatFrame; mode: WindowGesture } | null>(null);
  const [interacting, setInteracting] = useState(false);
  const pathname = usePathname();
  const mobile = useSyncExternalStore(subscribeMobile, isMobileChat, serverMobile);

  useLayoutEffect(() => {
    if (!mobile || !open) return;
    const element = panel.current;
    if (!element) return;
    const visual = globalThis.visualViewport;
    const fit = () => {
      // Follow the keyboard viewport without disabling the user's pinch zoom.
      if (visual && visual.scale !== 1) return;
      element.style.setProperty("--chat-mobile-top", `${visual?.offsetTop ?? 0}px`);
      element.style.setProperty("--chat-mobile-height", `${visual?.height || globalThis.innerHeight}px`);
    };
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    fit();
    visual?.addEventListener("resize", fit);
    visual?.addEventListener("scroll", fit);
    globalThis.addEventListener("resize", fit);
    return () => {
      visual?.removeEventListener("resize", fit);
      visual?.removeEventListener("scroll", fit);
      globalThis.removeEventListener("resize", fit);
      element.style.removeProperty("--chat-mobile-top");
      element.style.removeProperty("--chat-mobile-height");
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
    };
  }, [mobile, open]);

  useLayoutEffect(() => {
    if (mobile || !expanded || !open) return;
    const container = document.getElementById("main");
    const element = panel.current;
    if (!container || !element) return;

    // The chat lives in the persistent layout, outside the page's content container.
    const fitExpanded = () => {
      const rect = container.getBoundingClientRect();
      element.style.setProperty("--chat-expanded-left", `${rect.left}px`);
      element.style.setProperty("--chat-expanded-top", `${rect.top}px`);
      element.style.setProperty("--chat-expanded-width", `${rect.width}px`);
      element.style.setProperty("--chat-expanded-height", `${rect.height}px`);
      element.style.setProperty("--chat-expanded-radius", getComputedStyle(container).borderRadius);
    };
    fitExpanded();
    const observer = new ResizeObserver(fitExpanded);
    observer.observe(container);
    globalThis.addEventListener("resize", fitExpanded);
    globalThis.addEventListener("scroll", fitExpanded, true);
    return () => {
      observer.disconnect();
      globalThis.removeEventListener("resize", fitExpanded);
      globalThis.removeEventListener("scroll", fitExpanded, true);
    };
  }, [expanded, open, pathname, mobile]);

  // Fit the displayed rectangle before paint. Only manual moves and resizes
  // update the saved frame, so widening the viewport restores its position.
  const floatingFrame = !expanded && !mobile && open ? frame : null;
  const subscribe = floatingFrame ? subscribeViewport : noSubscription;
  const width = useSyncExternalStore(subscribe, floatingFrame ? viewportWidth : noSize, noSize);
  const height = useSyncExternalStore(subscribe, floatingFrame ? viewportHeight : noSize, noSize);
  const visible = floatingFrame && width > 0 && height > 0
    ? fitChatFrame(floatingFrame, { width, height }) : null;

  function currentFrame(): ChatFrame | null {
    const rect = panel.current?.getBoundingClientRect();
    return rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : null;
  }

  function start(event: PointerEvent<HTMLElement>, mode: WindowGesture) {
    if (mobile || expanded || !event.isPrimary || event.button !== 0 || gesture.current) return;
    const initial = currentFrame();
    if (!initial) return;
    event.preventDefault();
    event.currentTarget.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY, frame: initial, mode };
    setInteracting(true);
  }

  function move(event: PointerEvent<HTMLElement>) {
    const active = gesture.current;
    if (!active || active.id !== event.pointerId) return;
    update({ frame: adjustChatFrame(active.frame, active.mode, event.clientX - active.x, event.clientY - active.y, viewport()) });
  }

  function stop(event: PointerEvent<HTMLElement>) {
    if (gesture.current?.id !== event.pointerId) return;
    gesture.current = null;
    setInteracting(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  function keyboard(event: KeyboardEvent<HTMLElement>, mode: WindowGesture) {
    if (mobile || expanded || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    const initial = currentFrame();
    if (!initial) return;
    event.preventDefault();
    const step = event.shiftKey ? 40 : 10;
    const dx = event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
    const dy = event.key === "ArrowUp" ? -step : event.key === "ArrowDown" ? step : 0;
    update({ frame: adjustChatFrame(initial, mode, dx, dy, viewport()) });
  }

  const style: CSSProperties | undefined = visible ? { left: visible.x, top: visible.y, right: "auto", bottom: "auto", width: visible.width, height: visible.height } : undefined;
  const handlers = (mode: WindowGesture) => ({
    onPointerDown: (event: PointerEvent<HTMLElement>) => start(event, mode),
    onPointerMove: move, onPointerUp: stop, onPointerCancel: stop, onLostPointerCapture: stop,
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => keyboard(event, mode),
  });
  return { panel, style, interacting, handlers, mobile };
}
