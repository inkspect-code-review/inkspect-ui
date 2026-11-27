import "./dashboard-test-dom";
import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { ChatWindowProvider } from "../../../src/components/chat-window-provider";
import { NotificationProvider } from "../../../src/components/notification-toast";
import { SidebarProvider } from "../../../src/components/ui/sidebar";
import { WorkspaceChat, WorkspaceChatLauncher } from "../../../src/components/workspace-chat";

test("dock, pop out, restore and resize the same workspace conversation", async () => {
  let width = 1440;
  let height = 900;
  const events = new EventTarget();
  const visual = Object.assign(new EventTarget(), { width, height, scale: 1, offsetTop: 0 });
  Object.defineProperty(document.documentElement, "clientWidth", { configurable: true, get: () => width });
  Object.assign(globalThis, { innerHeight: height, visualViewport: visual,
    addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events) });
  const frame = { x: 940, y: 310, width: 480, height: 560 };
  const listeners = new Set<() => void>();
  const matchMedia = (query: string) => ({
    get matches() {
      const threshold = Number(query.match(/\d+/)?.[0]);
      return query.includes("min-width") ? width >= threshold : width <= threshold;
    },
    addEventListener: (_: string, fn: () => void) => listeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
  });
  Object.assign(globalThis, { matchMedia });
  Object.assign(window, { matchMedia });
  const saved = new Map([["inkspect:chat-layout:v1:test", JSON.stringify({ draft: "Existing question", open: false, frame })]]);
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => saved.get(key) ?? null,
    setItem: (key: string, value: string) => saved.set(key, value),
  } });
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (session: number, sidebarOpen = true) => act(() => root.render(
    <NotificationProvider><ChatWindowProvider key={session}><SidebarProvider open={sidebarOpen}>
      <WorkspaceChatLauncher panelId="chat" scopeKey="test" />
      <WorkspaceChat panelId="chat" scopeKey="test" organizationId="org" organizationName="Test" repositories={[]} />
    </SidebarProvider></ChatWindowProvider></NotificationProvider>
  ));
  const click = async (label: string) => {
    const button = host.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    assert.ok(button, label);
    await act(() => button.click());
  };
  const resize = async (nextWidth: number, nextHeight = 900) => {
    width = nextWidth;
    height = nextHeight;
    Object.assign(globalThis, { innerHeight: height });
    Object.assign(visual, { width, height });
    await act(() => {
      listeners.forEach(notify => notify());
      events.dispatchEvent(new Event("resize"));
    });
  };
  try {
    await render(0);
    const panel = () => host.querySelector<HTMLElement>("#chat")!;
    const draft = () => host.querySelector<HTMLTextAreaElement>("textarea")!;
    assert.equal(panel().hidden, false);
    assert.equal(panel().getAttribute("role"), "complementary");
    assert.equal(draft().value, "Existing question");
    const original = draft();
    await resize(1100);
    assert.equal(panel().hidden, false, "an open panel stays open when docking stops fitting");
    await resize(1440);
    await click("Pop out chat");
    assert.equal(panel().getAttribute("role"), "dialog");
    assert.equal(draft(), original);
    await resize(950, 600);
    assert.equal(panel().hidden, false);
    assert.equal(panel().style.left, "462px");
    assert.equal(panel().style.top, "32px");
    await resize(950, 400);
    assert.equal(panel().style.top, "8px");
    assert.equal(panel().style.height, "384px");
    await act(() => {
      visual.width = 820;
      visual.dispatchEvent(new Event("resize"));
    });
    assert.equal(panel().style.left, "332px");
    await resize(650, 480);
    assert.equal(panel().hidden, false);
    await resize(1440);
    assert.equal(panel().style.left, "940px");
    assert.equal(panel().style.top, "310px");
    assert.equal(draft(), original);
    await render(1);
    assert.equal(panel().getAttribute("role"), "dialog");
    await click("Dock chat on the right");
    await click("Minimize chat");
    await render(2);
    assert.equal(panel().hidden, true);
    await resize(1280);
    assert.equal(panel().getAttribute("role"), "dialog");
    await render(2, false);
    assert.equal(panel().getAttribute("role"), "complementary");
    assert.equal(panel().hidden, true);
    await click("Ask AI — open chat");
    assert.equal(panel().hidden, false);
    assert.equal(draft().value, "Existing question");
  } finally {
    await act(() => root.unmount());
    host.remove();
  }
});
