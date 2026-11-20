import assert from "node:assert/strict";
import test from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { buildOverview } from "@inkspect/core/lib/review-overview";
import { DashboardOverview, type InitialReviewOverview } from "../../../src/components/dashboard-overview";
import { RepositoriesWorkspace } from "../../../src/components/repositories-workspace";
import { SearchParamsContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";

const repositories = [{ id: 11, fullName: "example/first", private: false }, { id: 22, fullName: "example/second", private: true }];

const summary = { memberCount: 2, asOf: "2026-11-17T12:00:00Z" };
const empty = buildOverview([], new Map(), { now: new Date(summary.asOf), unavailable: 0 });
const review = {
  id: "J-example", repositoryId: 1, repository: "example/app", number: 3,
  url: "https://github.com/example/app/pull/3", status: "completed", createdAt: summary.asOf,
  decision: "ready_for_review" as const, findings: 0, severities: { critical: 0, high: 0, medium: 0, low: 0 },
};
const populated: InitialReviewOverview = { ...empty, totals: { ...empty.totals, reviews: 1, completed: 1, repositories: 1 }, recent: [review], latest: review, realtime_channel: "workspace-one" };
const render = (initialOverview?: InitialReviewOverview) => renderToStaticMarkup(<DashboardOverview organizationId="workspace-one" summary={summary} initialOverview={initialOverview} />);

test("dashboard repository rows link to their own details", () => {
  const html = renderToStaticMarkup(<DashboardOverview organizationId="workspace-one" summary={summary} initialOverview={empty} github={{ configured: true, canManage: true, dismissed: false, connections: [], repositories }} />);
  for (const repo of repositories) {
    assert.match(html, new RegExp(`<a[^>]+href="/dashboard\\?view=repositories&amp;repositoryId=${repo.id}"[^>]*>[^]*?<strong>${repo.fullName}</strong>[^]*?</a>`));
  }
});

test("repository URLs select the requested repository and fall back for invalid links", () => {
  for (const [query, name] of [["repositoryId=22", "second"], ["", "first"], ["repositoryId=missing", "first"], ["repositoryId=999", "first"]]) {
    const html = renderToStaticMarkup(<SearchParamsContext.Provider value={new URLSearchParams(query)}><RepositoriesWorkspace organizationId="workspace-one" repositories={repositories} canManage={true} /></SearchParamsContext.Provider>);
    assert.match(html, new RegExp(`<h2>${name}</h2>`));
    assert.match(html, new RegExp(`aria-current="true"[^>]+href="[^"]*repositoryId=${name === "second" ? 22 : 11}`));
    assert.match(html, /href="[^"]*repositoryId=22/);
  }
});

test("initial populated overview includes metrics, activity and recent reviews on the first render", () => {
  const html = render(populated);
  for (const label of ["Completed reviews", "Review activity", "Recent reviews", "Your repositories"]) assert.ok(html.includes(label));
  assert.doesNotMatch(html, /Loading your reviews|Bring your code into focus/);
  assert.ok(html.indexOf("Recent reviews") < html.indexOf("Your repositories"));
  assert.match(html, /\u00a0/); // Reserve the row for a title fetched after hydration.
});

test("empty initial overview shows its final empty state immediately", () => {
  const html = render(empty);
  assert.match(html, /Bring your code into focus/);
  assert.doesNotMatch(html, /Loading your reviews|Recent reviews/);
});

test("consumers without initial data retain client loading", () => {
  assert.match(render(), /Loading your reviews/);
});

test("server and browser time zones cannot change initial timestamps", () => {
  const previous = process.env.TZ;
  try {
    process.env.TZ = "Pacific/Honolulu";
    const html = render(populated);
    process.env.TZ = "Asia/Tokyo";
    assert.equal(render(populated), html);
    assert.match(html, /12:00 PM UTC/);
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test("a channel-less snapshot bootstraps a subscription and refreshes on a review event", async t => {
  const { window, document } = parseHTML("<html><body><div id='dashboard'></div></body></html>");
  const globals = { window, document, IS_REACT_ACT_ENVIRONMENT: true };
  for (const [name, value] of Object.entries(globals)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => original ? Object.defineProperty(globalThis, name, original) : Reflect.deleteProperty(globalThis, name));
  }
  const previousKey = process.env.NEXT_PUBLIC_PUBB_APP_KEY;
  process.env.NEXT_PUBLIC_PUBB_APP_KEY = "dashboard-test";
  t.after(() => {
    if (previousKey === undefined) delete process.env.NEXT_PUBLIC_PUBB_APP_KEY;
    else process.env.NEXT_PUBLIC_PUBB_APP_KEY = previousKey;
  });
  const sockets: TestSocket[] = [];
  class TestSocket {
    onmessage?: (event: { data: string }) => void;
    constructor() { sockets.push(this); }
    close() {}
  }
  t.mock.method(globalThis, "WebSocket", TestSocket);
  const fetchOverview = t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.match(url, /action=overview/);
    return Response.json({ ...empty, realtime_channel: "channel" });
  });
  const root = createRoot(document.getElementById("dashboard")!);
  try {
    await act(async () => root.render(<DashboardOverview organizationId="workspace-one" summary={summary} initialOverview={empty} />));
    assert.equal(fetchOverview.mock.callCount(), 1);
    const [socket] = sockets;
    assert.ok(socket?.onmessage);
    t.mock.timers.enable({ apis: ["setTimeout"] });
    await act(async () => {
      socket.onmessage!({ data: JSON.stringify({ channel: "channel", data: JSON.stringify({ name: "review.changed" }) }) });
      t.mock.timers.tick(1500);
    });
    assert.equal(fetchOverview.mock.callCount(), 2);
  } finally { await act(async () => root.unmount()); }
});
