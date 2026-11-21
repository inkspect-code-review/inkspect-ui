import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import postcss from "postcss";

test("the account dropdown opens above the expanded chat window", () => {
  const components = new URL("../../src/components/", import.meta.url);
  const chat = postcss.parse(readFileSync(new URL("workspace-chat.module.css", components), "utf8"));
  const dropdown = readFileSync(new URL("ui/dropdown-menu.tsx", components), "utf8");
  const menuLayer = dropdown.match(/data-slot="dropdown-menu-content"[\s\S]*?className=\{cn\(\s*"z-(\d+)\b/);
  assert.ok(menuLayer, "expected a layer on the portaled dropdown content");

  const chatLayers: number[] = [];
  chat.walkRules(rule => {
    if (rule.selectors.some(selector => selector === ".window" || selector === '.window[data-expanded="true"]')) {
      rule.walkDecls("z-index", declaration => { chatLayers.push(Number(declaration.value)); });
    }
  });
  assert.ok(chatLayers.length > 0);
  assert.ok(chatLayers.every(layer => layer < Number(menuLayer[1])));
});
