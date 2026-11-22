import assert from "node:assert/strict";
import test from "node:test";
import { dashboardEdition } from "../../src/self-hosted/dashboard-edition";

test("Usage stays routable and appears only in the account menu", () => {
  assert.ok(dashboardEdition.sections.some(section => section.id === "usage"));
  assert.equal(dashboardEdition.accountSections.filter(section => section === "usage").length, 1);
  assert.ok(dashboardEdition.navigation.every(group => !group.sections.includes("usage")));
});
