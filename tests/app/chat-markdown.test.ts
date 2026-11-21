import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown, ChatCopyButton } from "../../src/components/chat-markdown";

const render = (content: string) => renderToStaticMarkup(createElement(ChatMarkdown, { content }));

test("chat renders Markdown and GFM blocks as structured content", () => {
  const html = render('## Connect\n\nUse **TLS** and `connect()`.\n\n1. Get a token\n2. Open a socket\n\n> Keep the token private.\n\n```ts\nconst socket = connect();\n```\n\n| Option | Value |\n| --- | --- |\n| secure | true |\n\n- [x] Connected\n\n[Docs](https://example.com/docs)');
  for (const fragment of ["<h2>Connect</h2>", "<strong>TLS</strong>", "<code>connect()</code>", "<ol>", "<li>Get a token</li>", "<blockquote>", '<pre tabindex="0"><code class="language-ts">', '<div role="region" aria-label="Table" tabindex="0" data-markdown-table="true"><table>', "<th>Option</th>", 'type="checkbox"', 'target="_blank" rel="noopener noreferrer"']) {
    assert.ok(html.includes(fragment), fragment);
  }
});

test("untrusted chat Markdown cannot execute HTML, unsafe links or remote images", () => {
  const html = render('<script>alert(1)</script>\n\n<img src="https://tracker.invalid/pixel" onerror="alert(1)">\n\n[bad](javascript:alert%281%29)\n\n![diagram](https://tracker.invalid/pixel)\n\n```html\n<script>example</script>\n```');
  assert.doesNotMatch(html, /<script|<img|javascript:|onerror=|https:\/\/tracker/);
  assert.match(html, /<span>bad<\/span>/);
  assert.match(html, /<span>diagram<\/span>/);
  assert.match(html, /&lt;script&gt;example&lt;\/script&gt;/);
});

test("streamed incomplete code fences render without losing code whitespace", () => {
  const partial = 'Steps:\n\n```js\nfunction connect() {\n  return "wss://example.com";';
  const html = render(partial);
  assert.match(html, /<pre tabindex="0"><code class="language-js">/);
  assert.ok(html.includes('  return &quot;wss://example.com&quot;;'));
  assert.ok(render(partial + '\n}\n```').includes('\n}\n</code></pre>'));
});

test("copy writes the original response Markdown and reports denied clipboard access", async t => {
  const content = "Bir örnek\n\n```ts\nconst value = 1;\n```\n[S1]";
  const writes: string[] = [], results: string[] = [];
  const clipboard = {writeText: async (text: string) => { writes.push(text); }};
  t.mock.getter(globalThis, "navigator", () => ({clipboard}) as Navigator);
  const button = ChatCopyButton({content, className:"", notify: tone => results.push(tone)});
  assert.equal(button.props["aria-label"], "Copy response");
  await button.props.onClick();
  assert.deepEqual(writes, [content]);
  clipboard.writeText = async () => { throw new Error("Access denied"); };
  await button.props.onClick();
  assert.deepEqual(results, ["success", "error"]);
});

const repo = { id: 12, fullName: "example/widget", private: true };
const revision = "a".repeat(40);
const evidence = {
  id: "S1", repository: repo.fullName, repositoryId: repo.id, revision,
  path: "src/cart.ts", startLine: 8, endLine: 12,
  url: `https://github.com/example/widget/blob/${revision}/src/cart.ts#L8-L12`,
};
const context = { repositories: [repo], sources: [evidence] };
const finding = "**Sepet & stok** — İptalde `adet` iki kez ekleniyor [S1]. <!-- finding -->";
function taskLinks(content: string, taskContext: Parameters<typeof ChatMarkdown>[0]["taskContext"] = context) {
  const html = renderToStaticMarkup(createElement(ChatMarkdown, { content, taskContext }));
  return [...html.matchAll(/<a href="([^"]+)"[^>]*data-chat-task/g)].map(match => new URL(match[1].replaceAll("&amp;", "&")));
}

test("each completed finding opens its own issue draft with scoped evidence", () => {
  const second = { ...repo, id: 13, fullName: "example/other" };
  const [one, two] = taskLinks("- " + finding + "\n- **Second** — Another defect [R1]. <!-- finding -->", {
    repositories: [repo, second],
    sources: [evidence, { kind: "review", jobId: "example", id: "R1", repository: second.fullName,
      repositoryId: second.id, revision, url: "/dashboard?view=reviews", createdAt: "2026-01-01", pullNumber: 5 }],
  });
  assert.equal(one.origin + one.pathname, "https://github.com/example/widget/issues/new");
  assert.equal(one.searchParams.get("title"), "Sepet & stok");
  assert.equal(one.searchParams.get("body"), "İptalde adet iki kez ekleniyor.\n\n" + evidence.url);
  assert.equal(two.pathname, "/example/other/issues/new");
  assert.equal(two.searchParams.get("body"), "Another defect.\n\nhttps://github.com/example/other/pull/5 (revision " + revision + ")");
});

test("ordinary replies, uncited findings, examples and disconnected repositories have no task action", () => {
  for (const content of [
    "No issue found [S1].", finding.replace(" <!-- finding -->", ""),
    finding.replace("[S1]", "[S99]"), finding.replace("[S1]", "`[S1]`"),
    "> " + finding, "~~~md\n" + finding + "\n~~~",
  ]) assert.deepEqual(taskLinks(content), []);
  assert.deepEqual(taskLinks(finding, { ...context, repositories: [] }), []);
  assert.deepEqual(taskLinks(finding, { ...context, repositories: [{ ...repo, id: 99 }] }), []);
  assert.doesNotMatch(render(finding), /data-chat-task|<!-- finding -->/);
  assert.deepEqual(taskLinks(finding.replace("[S1]", "[S1] [S2]"), { ...context,
    sources: [evidence, { ...evidence, id: "S2", repositoryId: 99, repository: "another/project" }],
  }), []);
});

test("long multilingual drafts fit in a URL and retain their source", () => {
  const [url] = taskLinks(finding.replace("İptalde", "📌".repeat(4000)));
  assert.ok(url.href.length <= 7500);
  assert.ok(url.searchParams.get("body")?.endsWith(evidence.url));
});
