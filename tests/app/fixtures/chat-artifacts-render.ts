import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatSources} from "@inkspect/ui/components/chat-sources";
import {safeReviewDiagram,type ChatReference} from "@inkspect/core/lib/chat-review-evidence";
const scope={organizationId:'workspace',conversationId:'conversation',messageId:'message'};
test('code citations render compact tabs and only the selected preview, preserving ambiguous file references',()=>{
 const source:ChatReference={id:'S1',repository:'org/repo',repositoryId:17,revision:'b'.repeat(40),path:'src/auth/session.ts',startLine:3,endLine:8,url:'https://github.com/org/repo/blob/revision/src/auth/session.ts#L3-L8'};
 const html=renderToStaticMarkup(createElement(ChatSources,{...scope,sources:[source,{...source,id:'S2',path:'src/session.ts',startLine:40,endLine:60}]}));
 assert.equal((html.match(/role="tab"/g)||[]).length,2);
 assert.equal((html.match(/role="tabpanel"/g)||[]).length,1);
 assert.equal((html.match(/aria-selected="true"/g)||[]).length,1);
 assert.match(html,/src\/auth\/session.ts/);assert.match(html,/S1 · 3–8/);assert.match(html,/S2 · 40–60/);
 assert.match(html,/Lines 3–8/);assert.match(html,/Loading snippet/);assert.match(html,/Open on GitHub/);
 assert.doesNotMatch(html,/<details|Show chunk/);
 const panelId=html.match(/aria-controls="([^"]+)"/)![1];
 assert.ok(html.includes(`id="${panelId}"`));
 const empty=renderToStaticMarkup(createElement(ChatSources,{...scope,sources:[]}));
 assert.doesNotMatch(empty,/role="tab|undefined/);
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
