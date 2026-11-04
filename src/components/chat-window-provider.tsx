"use client";
import { reportBrowserError } from "@inkspect/core/lib/diagnostics/client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { chatDraftKey, emptyChatWindow, restoreChatDrafts, updateChatWindow, type ChatWindowState as WindowState } from "@inkspect/core/lib/chat-window-state";

const ChatWindowContext = createContext<{
  windows: Record<string, WindowState>;
  update: (key: string, changes: Partial<WindowState>) => void;
} | null>(null);

const layoutKey = (key: string) => `inkspect:chat-layout:v1:${key}`;

function readLayout(key: string): WindowState {
  const fallback = emptyChatWindow;
  try {
    const saved = JSON.parse(localStorage.getItem(layoutKey(key)) ?? "null");
    if (!saved || typeof saved !== "object") return fallback;
    const frame = saved.frame;
    const validFrame = frame && typeof frame === "object"
      && [frame.x, frame.y, frame.width, frame.height].every((value) => typeof value === "number" && Number.isFinite(value))
      && frame.width > 0 && frame.height > 0;
    const conversationId = typeof saved.conversationId === "string" && saved.conversationId.length > 0 && saved.conversationId.length <= 200 ? saved.conversationId : null;
    const drafts = restoreChatDrafts(saved, conversationId);
    return {
      frame: validFrame ? { x: frame.x, y: frame.y, width: frame.width, height: frame.height } : null,
      expanded: saved.expanded === true,
      open: saved.open === true,
      conversationId,
      drafts,
      draft: drafts[chatDraftKey(conversationId)] ?? "",
      repositoryScope: typeof saved.repositoryScope === "string" && /^(all|\d{1,20})$/.test(saved.repositoryScope) ? saved.repositoryScope : "all",
    };
  } catch (diagnosticError) { reportBrowserError("browser.chat.window.provider", diagnosticError);
    return fallback;
  }
}

export function ChatWindowProvider({ children }: { children: ReactNode }) {
  const [windows, setWindows] = useState<Record<string, WindowState>>({});
  const latest = useRef<Record<string, WindowState>>({});
  const update = useCallback((key: string, changes: Partial<WindowState>) => {
    // Restore after mounting, keeping server rendering and hydration identical.
    if (latest.current[key] && !Object.keys(changes).length) return;
    const next = updateChatWindow(latest.current[key] ?? readLayout(key), changes);
    latest.current[key] = next;
    setWindows((current) => ({ ...current, [key]: next }));
    if (Object.keys(changes).length) {
      try {
        localStorage.setItem(layoutKey(key), JSON.stringify(next));
      } catch (diagnosticError) { reportBrowserError("browser.chat.window.provider", diagnosticError);
        // Storage can be disabled or full; the in-memory window still works.
      }
    }
  }, []);
  return <ChatWindowContext.Provider value={{ windows, update }}>{children}</ChatWindowContext.Provider>;
}

export function useChatWindow(key: string) {
  const context = useContext(ChatWindowContext);
  if (!context) throw new Error("ChatWindowProvider is required.");
  const update = context.update;
  useEffect(() => { update(key, {}); }, [key, update]);
  const setWindow = useCallback((changes: Partial<WindowState>) => update(key, changes), [key, update]);
  return [context.windows[key] ?? emptyChatWindow, setWindow] as const;
}
