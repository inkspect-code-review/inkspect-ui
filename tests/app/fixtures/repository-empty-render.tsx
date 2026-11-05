import assert from 'node:assert/strict';
import test from 'node:test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {RepositoryEmptyState} from '../../../src/components/repository-empty-state';

test('empty repository is an informational state with first-commit guidance, not a failure',()=>{
 const html=renderToStaticMarkup(createElement(RepositoryEmptyState));
 assert.match(html,/role="status"/);
 assert.match(html,/This repository is empty\./);
 assert.match(html,/Add your first commit, then index this repository\./);
 assert.doesNotMatch(html,/role="alert"|did not complete|Analyze|<button/);
});
