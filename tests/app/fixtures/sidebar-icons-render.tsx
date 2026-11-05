import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { selfHostedDashboardEdition } from "@inkspect/core/lib/dashboard-edition";
import { AppSidebar } from "../../../src/components/app-sidebar";
import { DashboardEditionProvider, DashboardWidgetsProvider } from "../../../src/components/dashboard-edition";
import { SidebarProvider } from "../../../src/components/ui/sidebar";

const edition = {
  ...selfHostedDashboardEdition,
  sections: [...selfHostedDashboardEdition.sections, { id: "custom", name: "Custom page", description: "" }],
  navigation: [...selfHostedDashboardEdition.navigation, { title: "Extensions", sections: ["custom"] }],
};
const noop = () => {};

for (const open of [true, false]) {
  test(`application icon is visible with the sidebar ${open ? "expanded" : "collapsed"}`, () => {
    const html = renderToStaticMarkup(
      <DashboardEditionProvider value={edition}>
        <DashboardWidgetsProvider value={{ navigationIcons: { custom: <svg data-custom-icon="true" aria-hidden="true"><path d="M4 12h16" /></svg> } }}>
          <SidebarProvider defaultOpen={open}>
            <AppSidebar section="custom" homeHref="/dashboard" organizations={[]} activeOrganization={null}
              user={{ id: "test", name: "Test User", email: "test@example.invalid" }} busy={false} canCreateOrganization={true}
              onSelectOrganization={noop} onCreateOrganization={noop} onSignOut={noop} />
          </SidebarProvider>
        </DashboardWidgetsProvider>
      </DashboardEditionProvider>,
    );
    const customLink = html.match(/<a\b[^>]*aria-label="Custom page"[^>]*>.*?<\/a>/)?.[0];
    assert.ok(customLink);
    assert.match(customLink, /data-custom-icon="true"/);
    assert.match(customLink, /aria-current="page"/);
    assert.match(customLink, /href="\/dashboard\?view=custom"/);
    if (!open) assert.match(customLink, /title="Custom page"/);
    const dashboardLink = html.match(/<a\b[^>]*aria-label="Overview"[^>]*>.*?<\/a>/)?.[0];
    assert.ok(dashboardLink, "Default dashboard link remains available");
    assert.match(dashboardLink, /<svg[^>]*>.*?<rect/);
    assert.doesNotMatch(dashboardLink, /data-custom-icon/);
  });
}

test("standalone sidebar works without any application widget provider", () => {
  const html = renderToStaticMarkup(<SidebarProvider>
    <AppSidebar section="dashboard" homeHref="/dashboard" organizations={[]} activeOrganization={null}
      user={{ id: "test", name: "Test User", email: "test@example.invalid" }} busy={false} canCreateOrganization={true}
      onSelectOrganization={noop} onCreateOrganization={noop} onSignOut={noop} />
  </SidebarProvider>);
  assert.match(html, /aria-label="Overview"/);
  assert.doesNotMatch(html, /Custom page|data-custom-icon/);
});
