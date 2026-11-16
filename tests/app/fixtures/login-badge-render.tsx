import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LoginForm } from "../../../src/components/login-form";

test("last used badge is rendered on only the matching method", () => {
  const render = (props = {}) => renderToStaticMarkup(createElement(LoginForm, props));
  assert.doesNotMatch(render(), /Last used/);
  for (const lastUsedMethod of ["github", "google", "microsoft", "apple", "passkey", "email"]) {
    const html = render({ lastUsedMethod });
    assert.equal(html.match(/Last used/g)?.length, 1);
    if (lastUsedMethod === "email") assert.match(html, /<label[^>]*>Email address<span class="last-used-badge">Last used/);
    else {
      const buttons = html.match(/<button\b[^]*?<\/button>/g)!;
      const badged = buttons.filter(button => button.includes("Last used"));
      assert.equal(badged.length, 1);
      assert.ok(badged[0].toLowerCase().includes(lastUsedMethod));
    }
  }
  assert.doesNotMatch(render({ lastUsedMethod: "google", enabledProviders: ["github"] }), /Last used/);
  assert.doesNotMatch(render({ lastUsedMethod: "github", linkingProvider: "github" }), /Last used/);
});
