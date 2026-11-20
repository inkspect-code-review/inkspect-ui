import test from 'node:test';
import assert from 'node:assert/strict';
import {observeFixNotice} from '../../src/components/review-fix-notice';

const failed = {id:'fix-1',error:'The previous fix failed.'};
test('opening or reopening a report does not announce a historical fix failure',()=>{
  let state=observeFixNotice(null,'review-1',failed);
  assert.equal(state.error,'');
  state=observeFixNotice(state,'review-1',failed);
  assert.equal(state.error,'');
  assert.equal(observeFixNotice(state,'review-2',failed).error,'');
  assert.equal(observeFixNotice(null,'review-1',failed).error,'');
});
test('an observed active fix or newly admitted automatic fix still announces failure',()=>{
  for(const initial of [null,{id:'fix-1',error:null}]) {
    const baseline=observeFixNotice(null,'review-1',initial);
    const state=observeFixNotice(baseline,'review-1',failed);
    assert.equal(state.error,failed.error);
    assert.deepEqual(observeFixNotice(state,'review-1',failed),state);
  }
});
test('retry clears old errors, reports immediate failures, and distinguishes identical messages from new attempts',()=>{
  const old=observeFixNotice(null,'review-1',failed);
  const active=observeFixNotice(old,'review-1',{id:'fix-2',error:null},true);
  assert.equal(active.error,'');
  assert.equal(observeFixNotice(active,'review-1',{...failed,id:'fix-2'}).error,failed.error);
  assert.equal(observeFixNotice(old,'review-1',failed,true).error,failed.error);
  assert.equal(observeFixNotice({...old,error:''},'review-1',failed).error,'');
});
