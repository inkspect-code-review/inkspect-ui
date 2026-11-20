import test from 'node:test';
import assert from 'node:assert/strict';
import {reduceFixErrors} from '../../src/components/review-fix-errors';
const empty={jobId:'review',action:'',progress:'',revision:0};
test('successful status recovery and polling do not dismiss a failed fix action',()=>{
 let state=reduceFixErrors(empty,{jobId:'review',type:'action-error',message:'The reviewed commit changed.'});
 for(let n=0;n<3;n++)state=reduceFixErrors(state,{jobId:'review',type:'progress-ok'});
 assert.equal(state.action,'The reviewed commit changed.');assert.equal(state.revision,1);
 state=reduceFixErrors(state,{jobId:'review',type:'progress-error',message:'Connection interrupted'});
 state=reduceFixErrors(state,{jobId:'review',type:'progress-ok'});
 assert.equal(state.progress,'');assert.equal(state.action,'The reviewed commit changed.');
});
test('explicit retries clear the old action and repeated failures have a new notification identity',()=>{
 const failed=reduceFixErrors(empty,{jobId:'review',type:'action-error',message:'Changed'});
 const retry=reduceFixErrors(failed,{jobId:'review',type:'action-start'});
 assert.equal(retry.action,'');
 const again=reduceFixErrors(retry,{jobId:'review',type:'action-error',message:'Changed'});
 assert.equal(again.revision,2);
 assert.equal(reduceFixErrors(again,{jobId:'another-review',type:'progress-ok'}).action,'');
});
