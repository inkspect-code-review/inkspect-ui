import assert from 'node:assert/strict';
import test from 'node:test';
import { readHistoryPages } from '../../src/components/review-history-list';

test('refresh pagination from page one and stop when older pages disappear', async () => {
  const seen: number[] = [];
  const signal = new AbortController().signal;
  const window = await readHistoryPages(async (repo, page, requestSignal) => {
    assert.equal(repo, 42);
    assert.equal(requestSignal, signal);
    seen.push(page);
    return { entries: [], hasMore: page < 2 };
  }, 42, 4, signal);
  assert.deepEqual(seen, [1, 2]);
  assert.deepEqual(window, { pages: [[], []], hasMore: false });
});
