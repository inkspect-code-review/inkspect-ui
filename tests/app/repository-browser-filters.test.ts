import assert from "node:assert/strict";
import test from "node:test";
import { matchingRepositories, readIndexedIds, repositoryPage, starredRepositories } from "../../src/components/repository-browser-filters";

const repos = Array.from({ length: 43 }, (_, i) => ({
  id: i + 1, fullName: `team/repo-${String(i + 1).padStart(2, "0")}`, private: true,
}));

test("starred counts and results use connected search matches, including after removing the last visible star", () => {
  const stars = new Set([2, 99]);
  const matches = matchingRepositories(repos, "TEAM", stars);
  assert.deepEqual(starredRepositories(matches, stars).map(repo => repo.id), [2]);
  assert.equal(starredRepositories(matchingRepositories(repos, "repo-43", stars), stars).length, 0);
  stars.delete(2);
  assert.equal(starredRepositories(matches, stars).length, 0);
});

test("indexed filtering includes partial indexes on later pages and intersects with stars", async () => {
  const batches: number[] = [];
  const stars = new Set([42, 43, 99]);
  const matches = matchingRepositories(repos, "", stars);
  const indexed = await readIndexedIds(repos.map(repo => String(repo.id)), async batch => {
    batches.push(batch.length);
    return Object.fromEntries(batch.filter(id => id === "1" || id === "42").map(id => [id, id === "1" ? "indexed" : "partial"]));
  }, new AbortController().signal);
  assert.deepEqual(batches, [20, 20, 3]);
  const filtered = matches.filter(repo => indexed.has(repo.id));
  assert.deepEqual(repositoryPage(filtered, 1).pageRepositories.map(repo => repo.id), [42, 1]);
  assert.deepEqual(starredRepositories(filtered, stars).map(repo => repo.id), [42]);
});

test("an unavailable batch does not produce an incomplete index filter result", async () => {
  const ids = repos.map(repo => String(repo.id));
  await assert.rejects(readIndexedIds(ids, async batch => {
    if (batch.includes("21")) throw new Error("Coverage unavailable");
    return { "1": "indexed" };
  }, new AbortController().signal), /Coverage unavailable/);
});
