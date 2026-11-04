import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatMarkdown } from "../../src/components/chat-markdown";

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
