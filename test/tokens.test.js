// The design tokens (src/tokens.css): one place for colours, text sizes, spaces and corners, built into both pages.
// The counts below are a ratchet. Rules written before the tokens still carry colour codes and sizes of their own, and
// each screen gives them up as it is rebuilt. So the number left may go down and never up: a new rule names a token.
// No browser here; this reads the source.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const BUDGET = JSON.parse(read('test/tokens-budget.json'));

// The styles outside the token file: every .css in src, and the <style> of the two pages.
function styles() {
  const out = {};
  for (const f of fs.readdirSync(path.join(ROOT, 'src')).filter(f => f.endsWith('.css') && f !== 'tokens.css')) out['src/' + f] = read('src/' + f);
  for (const f of ['src/app.html', 'src/planner/planner.html']) out[f] = (read(f).match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  return out;
}
const count = rx => Object.values(styles()).reduce((n, css) => n + (css.replace(/\/\*[\s\S]*?\*\//g, '').match(rx) || []).length, 0);
const COUNTS = {
  'colour codes': () => count(/#[0-9a-fA-F]{3,8}\b/g),
  'text sizes': () => count(/font-size:\s*[\d.]+(px|pt)/g) + count(/font:[^;}]*?\b[\d.]+(px|pt)/g),
  'corners': () => count(/border-radius:\s*(?!var\()[^;}]*\d/g),
};

test('the tokens are defined once, in src/tokens.css, and built into both pages', () => {
  const tokens = read('src/tokens.css');
  for (const [f, css] of Object.entries(styles())) assert.ok(!/(^|[}\s]):root(\[data-theme="dark"\])?\s*\{/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')), f + ' sets values on :root; they belong in src/tokens.css');
  for (const f of ['src/app.html', 'src/planner/planner.html']) assert.equal(read(f).split('/*@@TOKENS@@*/').length, 2, f + ' takes the tokens once');
  for (const f of ['index.html', 'planner.html']) assert.equal(read(f).split('--text-caption:').length, 2, f + ' has the tokens built in once');
  // light and dark name the same colours
  const names = block => [...block.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]);
  const light = names(tokens.match(/:root\{([\s\S]*?)\n\}/)[1]), dark = names(tokens.match(/:root\[data-theme="dark"\]\{([\s\S]*?)\n\}/)[1]);
  assert.deepEqual(dark.filter(n => !light.includes(n)), [], 'a dark value with no light one');
  const colours = light.filter(n => /^--(bg|surface|hover|track|line|fg|muted|faint|accent|warn|ok|bad|paper|shadow)/.test(n));
  assert.deepEqual(colours.filter(n => !dark.includes(n)), [], 'a colour with no dark value');
});

// Names a few Planner rules used before the tokens that were never defined; the rules fall back to a colour of their own.
// Each goes when its screen is rebuilt. Nothing may be added.
const OLD_GAPS = ['--card', '--bg-soft', '--text', '--danger'];
test('every token a rule names exists', () => {
  const defined = new Set([...read('src/tokens.css').matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
  const local = /--(th|pc|w|h|x|y|n|i|c|col|rows?|cols?|z|s|k|p|pad|gap|size|ang|deg|tint|dot|bar|fill|at|from|to)\b/;   // set by a rule or by code for its own use
  const missing = {};
  for (const [f, css] of Object.entries(styles())) {
    const own = new Set([...css.matchAll(/(--[a-z0-9-]+)\s*:/g)].map(m => m[1]));
    for (const m of css.matchAll(/var\((--[a-z0-9-]+)/g)) if (!defined.has(m[1]) && !own.has(m[1]) && !local.test(m[1])) (missing[m[1]] ||= new Set()).add(f);
  }
  // a name used by a rule but set from code (style.setProperty) is fine when the code really sets it
  const code = fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter(f => /\.(js|html)$/.test(f)).map(f => read('src/' + f)).join('\n');
  const lost = Object.keys(missing).filter(n => !code.includes(n + ':') && !code.includes("'" + n + "'") && !code.includes('"' + n + '"'));
  assert.deepEqual(lost.filter(n => !OLD_GAPS.includes(n)), [], 'named by a rule, defined nowhere');
  assert.deepEqual(OLD_GAPS.filter(n => !lost.includes(n)), [], 'no longer missing: take it off OLD_GAPS');
});

for (const [what, now] of Object.entries(COUNTS)) test(what + ' written outside the tokens: no more than before', () => {
  const n = now(), max = BUDGET[what];
  assert.ok(n <= max, n + ' ' + what + ' are written straight into rules, and the most allowed is ' + max + '. Name a token from src/tokens.css in the new rule.');
  assert.ok(n >= max, 'Good: only ' + n + ' ' + what + ' are left outside the tokens. Lower "' + what + '" in test/tokens-budget.json from ' + max + ' to ' + n + ' so it stays that way.');
});
