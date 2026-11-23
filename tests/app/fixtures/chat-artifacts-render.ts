import assert from 'node:assert/strict';
import test from 'node:test';
import {act, createElement} from 'react';
import {createRoot} from "react-dom/client";
import {parseHTML} from "linkedom";
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatSources} from "@inkspect/ui/components/chat-sources";
import {safeReviewDiagram,type ChatReference} from "@inkspect/core/lib/chat-review-evidence";
const scope={organizationId:'workspace',conversationId:'conversation',messageId:'message'};
test('conversation history only requests a code snippet when the reader opens its source', async t => {
 const {window, document} = parseHTML('<html><body><main></main></body></html>');
 for (const [name, value] of Object.entries({window, document, IS_REACT_ACT_ENVIRONMENT: true})) {
  const original = Object.getOwnPropertyDescriptor(globalThis, name);
  Object.defineProperty(globalThis, name, {configurable: true, value});
  t.after(() => original ? Object.defineProperty(globalThis, name, original) : Reflect.deleteProperty(globalThis, name));
 }
 const request = t.mock.method(globalThis, 'fetch', async (url: string) => {
  const id = new URL(url, 'https://example.test').searchParams.get('sourceId');
  return Response.json({source: {content: `code for ${id}`}});
 });
 const source: ChatReference = {id:'S1',repository:'org/repo',repositoryId:17,revision:'b'.repeat(40),path:'src/auth/session.ts',startLine:3,endLine:8,url:'https://github.com/org/repo/blob/revision/src/auth/session.ts#L3-L8'};
 const sources = [source, {...source, id:'S2', path:'src/session.ts', startLine:40,endLine:60}];
 const root = createRoot(document.querySelector('main')!);
 try {
  await act(async () => root.render(createElement(ChatSources, {...scope, sources})));
  const [first, second] = document.querySelectorAll<HTMLButtonElement>('button');
  assert.match(first.textContent!, /S1 · 3–8/);
  assert.match(second.textContent!, /S2 · 40–60/);
  assert.equal(document.querySelector('[aria-expanded="true"]'), null);
  assert.equal(request.mock.callCount(), 0);

  await act(async () => second.click());
  assert.equal(request.mock.callCount(), 1);
  assert.equal(second.getAttribute('aria-expanded'), 'true');
  assert.match(document.getElementById(second.getAttribute('aria-controls')!)!.textContent!, /code for S2/);
  await act(async () => first.click());
  assert.equal(request.mock.callCount(), 2);
  assert.match(document.querySelector('pre')!.textContent!, /code for S1/);
  await act(async () => first.click());
  assert.equal(document.querySelector('pre'), null);
  assert.equal(request.mock.callCount(), 2);
 } finally { await act(async () => root.unmount()); }
});
test('saved review diagrams render as an SVG artifact with a real report reference',()=>{
 const diagram=safeReviewDiagram({title:'Saved flow',view:'current',nodes:[{id:'a',label:'Validate <script>bad</script>'},{id:'b',label:'Save'}],edges:[{from:'a',to:'b'}]})!;
 const reference:ChatReference={kind:'review',id:'R1',repository:'org/repo',repositoryId:17,jobId:'J-'+'a'.repeat(32),revision:'b'.repeat(40),createdAt:'2026-10-29T08:00:00Z',pullNumber:2,url:'/dashboard?view=reviews&repositoryId=17',diagram};
 const html=renderToStaticMarkup(createElement(ChatSources,{...scope,sources:[reference]}));
 assert.match(html,/<svg/);assert.match(html,/Saved flow/);assert.match(html,/PR #2/);assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script|<img|<iframe/);
});
test('company rules have their own title and line reference instead of a fabricated repository path',()=>{
 const source:ChatReference={kind:'knowledge',id:'K1',documentId:'policy',title:'Input validation policy',digest:'a'.repeat(64),startLine:3,endLine:8,url:'/dashboard?view=knowledge&documentId=policy'};
 const html=renderToStaticMarkup(createElement(ChatSources,{...scope,sources:[source]}));
 assert.match(html,/Input validation policy/);assert.match(html,/Knowledge Center/);assert.match(html,/Lines 3–8/);assert.doesNotMatch(html,/undefined\/|Show chunk/);
});
