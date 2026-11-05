import assert from "node:assert/strict";
import test from "node:test";
import type { ComponentProps, MouseEvent, ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewProviderSelector } from "../../../src/components/byok-settings";

const options = [
  { mode: "managed" as const, label: "Instance provider", available: true },
  { mode: "byok" as const, label: "Organization provider", available: true },
];

for (const current of ["managed", "byok"] as const) {
  test(`${current} is labeled active and cannot be saved again`, () => {
    const changes: string[] = [];
    const tree = ReviewProviderSelector({ current, options, disabled: false,
      connectionLabel: "Example provider · Example model", onChange: mode => changes.push(mode) });
    const html = renderToStaticMarkup(tree);
    assert.match(html, /Active provider/);
    const buttonHtml = [...html.matchAll(/<button\b[^>]*>.*?<\/button>/g)].map(match => match[0]);
    const active = buttonHtml.find(button => button.includes('aria-pressed="true"'));
    assert.ok(active);
    assert.match(active, /disabled=""/);
    assert.match(active, />Active<\/span>/);
    assert.equal(buttonHtml.filter(button => button.includes('aria-pressed="true"')).length, 1);
    assert.equal(html.includes("Example provider · Example model"), current === "byok");

    const buttons = tree.props.children[1].props.children as ReactElement<ComponentProps<"button">>[];
    buttons.find(button => button.props["aria-pressed"])?.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
    assert.deepEqual(changes, [], "Even a direct active-button event cannot repeat the change");
    buttons.find(button => !button.props["aria-pressed"])?.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
    assert.deepEqual(changes, [current === "managed" ? "byok" : "managed"]);
  });
}

for (const disabled of [false, true]) {
  test(`unavailable or non-editable providers never submit (disabled=${disabled})`, () => {
    const changes: string[] = [];
    const tree = ReviewProviderSelector({ current: "managed", disabled,
      options: options.map(option => ({ ...option, available: disabled || option.mode === "managed" })),
      onChange: mode => changes.push(mode) });
    const buttons = tree.props.children[1].props.children as ReactElement<ComponentProps<"button">>[];
    for (const button of buttons) {
      assert.equal(button.props.disabled, true);
      button.props.onClick?.({} as MouseEvent<HTMLButtonElement>);
    }
    assert.deepEqual(changes, []);
  });
}
