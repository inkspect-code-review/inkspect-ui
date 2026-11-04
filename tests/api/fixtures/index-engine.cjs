#!/usr/bin/env node
const fs = require('node:fs');
const argument = name => process.argv[process.argv.indexOf(name) + 1];
const job = JSON.parse(fs.readFileSync(argument('--job'), 'utf8'));
const path = process.env.INKSPECT_INDEX_PROGRESS_FILE;
const logs = [];
function publish(stage, scan, chunks, embedded, indexed) {
  logs.push({ key: `progress:${stage}`, at: Date.now(), message: stage });
  const progress = { stage, scan, chunks, embedded, indexed, logs };
  fs.writeFileSync(path + '.tmp', JSON.stringify(progress));
  fs.renameSync(path + '.tmp', path);
}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const scan = { measured: false, stage: '', total: 0, processed: 0, read: 0, skipped: 0, chunks: 0 };
  publish('cloning', scan, 0, 0, false);
  await wait(750);
  Object.assign(scan, { measured: true, stage: 'completed', total: 3, processed: 3, read: 2, skipped: 1, chunks: 9 });
  publish('embedding', scan, 9, 5, false);
  if (job.fail) { await wait(750); process.exit(1); }
  await wait(750);
  publish('summarizing', scan, 9, 9, true);
  fs.writeFileSync(argument('--out'), JSON.stringify({ scan, chunks: 9, embedded: 9, indexed: true }));
})();
