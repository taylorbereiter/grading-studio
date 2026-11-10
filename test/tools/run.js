// npm test: runs every test file, a few at a time, and says plainly what failed.
//   node test/tools/run.js                 every file in test/
//   node test/tools/run.js marking shell   only the files whose names contain one of these words
//   JOBS=1 node test/tools/run.js          one file at a time (the default is one per processor, up to 4)
// Each file gets its own Chrome with a throwaway profile, so files can't disturb each other. A file that fails while
// others were running is run once more on its own: if it passes then, it is listed under "passed on a second try"
// so a test that depends on timing is seen, and the run still counts as failed if it fails alone.
const fs = require('fs'), os = require('os'), path = require('path'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), DIR = path.join(ROOT, 'test');
const words = process.argv.slice(2).filter(a => !a.startsWith('-'));
const files = fs.readdirSync(DIR).filter(f => f.endsWith('.test.js') && (!words.length || words.some(w => f.includes(w)))).sort();
const JOBS = Math.max(1, +process.env.JOBS || Math.min(4, os.cpus().length));
const LOGS = path.join(ROOT, 'out', 'test-logs');
fs.rmSync(LOGS, { recursive: true, force: true }); fs.mkdirSync(LOGS, { recursive: true });

function runFile(f, tag = '') {
  return new Promise(resolve => {
    const t0 = Date.now(), log = path.join(LOGS, f.replace(/\.test\.js$/, '') + tag + '.log'), out = fs.createWriteStream(log);
    const p = spawn(process.execPath, ['--test', '--test-reporter=spec', '--test-concurrency=1', '--test-timeout=300000', path.join('test', f)], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    p.stdout.pipe(out, { end: false }); p.stderr.pipe(out, { end: false });
    p.on('close', code => out.end(() => resolve({ f, ok: code === 0, secs: Math.round((Date.now() - t0) / 1000), log })));
  });
}
// The names of the tests that failed in a file's log, for the summary.
function failedNames(log) {
  const t = fs.readFileSync(log, 'utf8'), names = [];
  for (const m of t.matchAll(/^✖ (.+?)(?: \([\d.]+ms\))?$/gm)) if (!names.includes(m[1])) names.push(m[1]);
  return names.filter(n => !/\.test\.js$/.test(n) && n !== 'failing tests:');
}
(async () => {
  if (!files.length) { console.error('No test files match ' + words.join(', ')); process.exit(1); }
  const t0 = Date.now(), queue = files.slice(), done = [];
  console.log('Running ' + files.length + ' test file' + (files.length === 1 ? '' : 's') + ', ' + JOBS + ' at a time.');
  await Promise.all(Array.from({ length: Math.min(JOBS, queue.length) }, async () => {
    for (let f; (f = queue.shift());) { const r = await runFile(f); done.push(r); console.log((r.ok ? '  ok    ' : '  FAIL  ') + f + '  ' + r.secs + 's'); }
  }));
  const again = [], failed = [];
  for (const r of done.filter(r => !r.ok).sort((a, b) => a.f.localeCompare(b.f))) {
    if (JOBS === 1 || files.length === 1) { failed.push(r); continue; }
    console.log('  again ' + r.f + ' on its own…');
    const r2 = await runFile(r.f, '.again');
    (r2.ok ? again : failed).push(Object.assign(r2, { first: failedNames(r.log) }));
  }
  const mins = ((Date.now() - t0) / 60000).toFixed(1);
  let sum = '';
  if (again.length) sum += '\nPassed on a second try, on their own (timing under load):\n' + again.map(r => '  ' + r.f + (r.first.length ? ': ' + r.first.join('; ') : '')).join('\n') + '\n';
  if (failed.length) sum += '\nFAILED:\n' + failed.map(r => '  ' + r.f + '\n' + failedNames(r.log).map(n => '    ✖ ' + n).join('\n') + '\n    log: ' + path.relative(ROOT, r.log)).join('\n') + '\n';
  sum += '\n' + (failed.length ? failed.length + ' of ' + files.length + ' files failed' : 'All ' + files.length + ' files passed') + ' in ' + mins + ' min.';
  console.log(sum);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, '### Tests\n```\n' + sum.trim() + '\n```\n');
  process.exit(failed.length ? 1 : 0);
})();
