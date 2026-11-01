// The made-up papers must come out the same on any computer. Saved-work fixtures are checked against their hashes,
// so a difference here turns every old-format test red with nothing actually wrong.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
// Runs in a new process, because a process picks up its time zone when it starts. loadLegacy throws if a generated paper differs from the frozen hash.
const CHECK = `require('./test/helpers/legacy').loadLegacy().then(() => console.log(new Date(2026, 8, 1, 12).getTimezoneOffset()))`;
for (const [zone, offset] of [['UTC', 0], ['Asia/Taipei', -480], ['Asia/Tokyo', -540], ['America/New_York', 240], ['Asia/Kolkata', -330], ['Pacific/Kiritimati', -840]]) test('the fixtures match the old build’s hashes with the clock set to ' + zone, () => {
  const r = spawnSync(process.execPath, ['-e', CHECK], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, TZ: zone } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(+r.stdout.trim(), offset, 'the zone really took effect');
});
