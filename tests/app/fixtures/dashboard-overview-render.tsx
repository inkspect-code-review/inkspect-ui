import "./dashboard-test-dom";
import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { renderToStaticMarkup } from "react-dom/server";
import { buildOverview } from "@inkspect/core/lib/review-overview";
import { DashboardOverview, type InitialReviewOverview } from "../../../src/components/dashboard-overview";
import { ReviewWorkspace } from "../../../src/components/review-workspace";
import { RepositoriesWorkspace } from "../../../src/components/repositories-workspace";
import { FindingsPanel } from "../../../src/components/findings-panel";
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

test("each dashboard metric links to its workspace view", () => {
  const { document } = parseHTML(render(populated));
  const cards = document.querySelectorAll('nav[aria-label="Review metrics"] > a');
  assert.deepEqual(Array.from(cards, card => [card.firstElementChild?.textContent, card.getAttribute("href")]), [
    ["Completed reviews", "/dashboard?view=reviews"],
    ["Open findings", "/dashboard?view=findings&status=open"],
    ["Reviews without blockers", "/dashboard?view=reviews"],
    ["Repositories reviewed", "/dashboard?view=repositories"],
  ]);
});

test("findings links select the requested status and default to all history", () => {
  for (const [query, label] of [["status=open", "Open"], ["", "All history"], ["status=invalid", "All history"]]) {
    const html = renderToStaticMarkup(<SearchParamsContext.Provider value={new URLSearchParams(query)}>
      <FindingsPanel organizationId="workspace-one" workspaceName="Example" connected canManage repositories={[{ id: 11, full_name: "example/first", private: false }]} />
    </SearchParamsContext.Provider>);
    assert.equal(parseHTML(html).document.querySelector("#findings-status")?.getAttribute("aria-label"), `Status: ${label}`);
  }
});

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

function dashboardDocument(t: TestContext) {
  document.body.innerHTML = "<div id='dashboard'></div>";
  t.after(() => { document.body.innerHTML = ""; });
  return document;
}

test("a channel-less snapshot bootstraps a subscription and refreshes on a review event", async t => {
  const document = dashboardDocument(t);
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
  const socketDescriptor = Object.getOwnPropertyDescriptor(globalThis, "WebSocket")!;
  Object.defineProperty(globalThis, "WebSocket", { configurable: true, value: TestSocket });
  t.after(() => Object.defineProperty(globalThis, "WebSocket", socketDescriptor));
  t.mock.timers.enable({ apis: ["setTimeout"] });
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
    await act(async () => {
      socket.onmessage!({ data: JSON.stringify({ channel: "channel", data: JSON.stringify({ name: "review.changed" }) }) });
      t.mock.timers.tick(1500);
    });
    assert.equal(fetchOverview.mock.callCount(), 2);
  } finally { await act(async () => root.unmount()); }
});

test("the review composer retries the failed job when the server selected its model", async t => {
  const document = dashboardDocument(t);
  const repo = { id: 17, full_name: "example/app", private: true };
  const pull = { number: 3, url: "https://github.com/example/app/pull/3", title: "Example", draft: false, head: "b".repeat(40), base_tip: "a".repeat(40) };
  const previous = {
    job: { id: "J-" + "1".repeat(32), status: "failed", created_at: summary.asOf },
    snapshot: { ...pull, repository_id: String(repo.id), review_model_id: "example-model" },
  };
  const submissions: unknown[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    switch (new URL(url, "https://example.test").searchParams.get("action")) {
      case "repositories": return Response.json({ repositories: [repo] });
      case "history": return Response.json({ reviews: [previous] });
      case "configuration": return Response.json({ execution_mode: "api", byok_credential_id: "" });
      case "pulls": return Response.json({ pulls: [pull], has_more: false });
      case "pull-title": return Response.json({ title: pull.title });
      case "activity": return Response.json({ events: [], next_cursor: 0, has_more: false });
      case "start":
        submissions.push(JSON.parse(String(init.body)));
        return Response.json({ ...previous, job: { ...previous.job, id: "J-" + "2".repeat(32), status: "queued" } });
      default: throw new Error("Unexpected review request");
    }
  });
  const root = createRoot(document.getElementById("dashboard")!);
  const button = (label: string) => {
    const match = Array.from(document.querySelectorAll("button")).find(item => item.textContent === label);
    assert.ok(match, `Expected button ${label}`);
    return match;
  };
  try {
    await act(async () => root.render(<ReviewWorkspace organizationId="workspace-one" initialRepositories={[repo]} />));
    await act(async () => button("New review").click());
    await act(async () => {
      const composer = document.querySelector("#review-composer")!;
      Array.from(composer.querySelectorAll("button")).find(item => item.textContent === "Retry review")!.click();
    });
    assert.deepEqual(submissions, [{ number: pull.number, base_tip: pull.base_tip, head: pull.head, retry_of: previous.job.id }]);
  } finally { await act(async () => root.unmount()); }
});

test("retrying from a failed review confirms its repository, PR and commit without opening the composer", async t => {
  const document = dashboardDocument(t);
  const repos = [{ id: 11, full_name: "example/first" }, { id: 22, full_name: "example/second" }];
  const failed = {
    job: { id: "J-" + "1".repeat(32), status: "failed", created_at: summary.asOf },
    snapshot: { repository_id: "22", url: "https://github.com/example/second/pull/7", title: "Test PR", base_tip: "a".repeat(40), head: "c".repeat(40) },
  };
  const next = { ...failed, job: { ...failed.job, id: "J-" + "2".repeat(32), status: "queued" } };
  const submissions: unknown[] = [];
  const requests: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string, init: RequestInit) => {
    const query = new URL(url, "https://example.test").searchParams;
    const action = query.get("action")!;
    requests.push(action);
    switch (action) {
      case "repositories": return Response.json({ repositories: repos });
      case "history": return Response.json({ reviews: submissions.length ? [next, failed] : [failed] });
      case "activity": return Response.json({ events: [], has_more: false });
      case "start":
        submissions.push([query.get("repositoryId"), JSON.parse(String(init.body))]);
        return Response.json(next);
      default: throw new Error("Unexpected review request: " + action);
    }
  });
  const root = createRoot(document.getElementById("dashboard")!);
  const retry = () => Array.from(document.querySelectorAll("button")).find(item => item.textContent === "Retry review")!;
  try {
    await act(async () => root.render(<ReviewWorkspace organizationId="workspace-one" />));
    await act(async () => retry().click());
    const dialog = () => document.querySelector('[role="alertdialog"]');
    assert.match(dialog()?.textContent || "", /Retry review for PR #7/);
    assert.match(dialog()!.textContent!, /ccccccc/);
    assert.deepEqual(submissions, []);
    await act(async () => Array.from(dialog()!.querySelectorAll("button")).find(item => item.textContent === "Cancel")!.click());
    assert.equal(dialog(), null);
    assert.deepEqual(submissions, []);
    await act(async () => retry().click());
    await act(async () => dialog()!.querySelector<HTMLButtonElement>('button[aria-label="Start review"]')!.click());
    assert.deepEqual(submissions, [["22", { number: 7, base_tip: failed.snapshot.base_tip, head: failed.snapshot.head, retry_of: failed.job.id }]]);
    assert.equal(requests.includes("pulls"), false);
    assert.equal(document.querySelector("#review-composer"), null);
    assert.match(document.body.textContent!, /Review queued/);
  } finally { await act(async () => root.unmount()); }
});
