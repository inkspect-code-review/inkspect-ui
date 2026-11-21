import assert from "node:assert/strict";
import test from "node:test";
import { reviewDateBounds } from "../../src/components/findings-date-range";

test("presets include today and span the selected number of local calendar dates", () => {
  // October 25 is the UK autumn clock change in 2026.
  const today = new Date(2026, 9, 27, 15, 45);
  for (const days of [7, 15, 30] as const) {
    assert.deepEqual(reviewDateBounds(days, today), {
      from: new Date(2026, 9, 28 - days).toISOString(),
      before: new Date(2026, 9, 28).toISOString(),
    });
  }
});

test("custom bounds support a single day, open ends and all time", () => {
  const day = "2026-12-31";
  const start = new Date(2026, 11, 31).toISOString();
  const end = new Date(2027, 0, 1).toISOString();
  assert.deepEqual(reviewDateBounds({ from: day, to: day }), { from: start, before: end });
  assert.deepEqual(reviewDateBounds({ from: day, to: "" }), { from: start, before: "" });
  assert.deepEqual(reviewDateBounds({ from: "", to: day }), { from: "", before: end });
  assert.deepEqual(reviewDateBounds("all"), { from: "", before: "" });
});
