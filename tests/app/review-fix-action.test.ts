import test from 'node:test';
import assert from 'node:assert/strict';
import { fixAction, retainFixReadiness, latestReviewAction, reviewBlockerMessage } from '../../src/components/review-fix-action';

test('file changes require a separate confirmation and carry the exact displayed approval',()=>{
  const approval={head:'a'.repeat(40),paths:['.github/workflows/check.yml','Dockerfile']};
  const state={available:true,pr_open:true,fix:null,approval};
  assert.deepEqual(fixAction(state),{kind:'approve'});
  assert.deepEqual(fixAction(state,true),{kind:'submit',body:{approval}});
  assert.deepEqual(fixAction({...state,fix:{id:'previous',retryable:true}},true),{kind:'submit',body:{retry_of:'previous',approval}});
  assert.deepEqual(fixAction({...state,approval:undefined}),{kind:'submit',body:{}});
  for(const patch of [{pr_open:false},{pr_open:undefined},{available:false},{fix:{id:'running',retryable:false}}])
    assert.deepEqual(fixAction({...state,...patch},true),{kind:'blocked'});
});

test('offline progress cannot re-enable fixes on a stale or draft review',()=>{
 const result={available:true,fix:null};
 for(const readiness of [{review_stale:true,pr_ready:false},{review_stale:false,pr_ready:false}]) {
  const state=retainFixReadiness({...result,pr_open:true,...readiness,review_reason:'Review required'},result);
  assert.deepEqual(fixAction(state,true),{kind:'blocked'});
  assert.equal(state.review_reason,'Review required');
  const refreshed=retainFixReadiness(state,{...result,pr_open:true,pr_ready:true,review_stale:false});
  assert.deepEqual(fixAction(refreshed),{kind:'submit',body:{}});
  assert.equal(refreshed.review_reason,undefined);
 }
});

test('stale reports offer a read-only recheck or navigation to an existing review',()=>{
 assert.equal(latestReviewAction(null).label,'Check again');
 assert.match(latestReviewAction(null).note,/New review/);
 for(const status of ['queued','running','paused','completed','failed','cancelled'])
   assert.deepEqual(latestReviewAction({id:'current',status}),{label:'View latest review',note:`Latest review status: ${status}.`});
 const state={available:false,pr_open:true,review_stale:true,latest_review:{id:'current',status:'running'}};
 assert.deepEqual(retainFixReadiness(state,{available:true}).latest_review,state.latest_review);
 assert.equal(retainFixReadiness(state,{available:false,pr_open:true,latest_review:null}).latest_review,null);
});

test('missing reviews explain blockers without claiming work is in progress',()=>{
 for(const blocker of ['ignored_author','automatic_disabled','draft','not_scheduled'] as const) {
  assert.deepEqual(latestReviewAction(null,blocker),{label:'Check again',note:reviewBlockerMessage(blocker)});
  assert.equal(latestReviewAction({id:'latest',status:'completed'},blocker).label,'View latest review');
  const previous={available:false,pr_open:true,review_blocker:blocker};
  assert.equal(retainFixReadiness(previous,{available:true}).review_blocker,blocker);
  assert.equal(retainFixReadiness(previous,{available:false,pr_open:true,review_blocker:null}).review_blocker,null);
 }
 assert.equal(reviewBlockerMessage(null),undefined);
});
