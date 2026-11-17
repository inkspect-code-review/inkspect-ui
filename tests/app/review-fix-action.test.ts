import test from 'node:test';
import assert from 'node:assert/strict';
import { fixAction } from '../../src/components/review-fix-action';

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
