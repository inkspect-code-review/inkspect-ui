import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { Bell } from "lucide-react";
import { PersonalSettings } from "../../../src/components/settings-workspace";
const user={name:"Example",email:"example@example.test"};
const section={id:"alerts",label:"Alerts",description:"Personal alerts",icon:Bell,content:<p>Custom preferences</p>};
function selected(html:string,label:string){return [...html.matchAll(/<button\b[^>]*>.*?<\/button>/g)].some(([tag])=>tag.includes(`aria-label="${label}"`)&&tag.includes('aria-selected="true"'));}
test("default account settings stay unchanged",()=>{
 const html=renderToStaticMarkup(<PersonalSettings user={user}/>);
 assert.ok(selected(html,"Your account"));assert.ok(!html.includes('aria-label="Alerts"'));
});
test("registered account tab is selectable with its own accessible content",()=>{
 const html=renderToStaticMarkup(<PersonalSettings user={user} additionalSections={[section]} defaultSection="alerts"/>);
 assert.ok(selected(html,"Alerts"));assert.match(html,/Custom preferences/);assert.ok(!selected(html,"Your account"));
});
test("the account footer follows security settings", () => {
 const html = renderToStaticMarkup(<PersonalSettings user={user} accountFooter={<button>Example action</button>} />);
 const security = html.indexOf('id="security-settings-heading"');
 assert.ok(security >= 0);
 assert.ok(html.indexOf("Example action") > security);
});
test("unknown defaults and reserved extension IDs cannot hide account settings",()=>{
 const html=renderToStaticMarkup(<PersonalSettings user={user} additionalSections={[{...section,id:"account"}]} defaultSection="missing"/>);
 assert.ok(selected(html,"Your account"));assert.ok(!html.includes('aria-label="Alerts"'));
});
