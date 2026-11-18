// The six themes: every text and control pair passes WCAG AA in every theme, red is only for marks, no sage or yellow-green,
// and nothing follows the computer's light or dark setting. Worked out from next/src/ui/tokens.js, with no browser.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path');
const NEXT = path.join(__dirname, '..');

const rgb = h => { assert.match(h, /^#[0-9A-F]{6}$/i, 'not an opaque hex: ' + h); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4; };
const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(rgb(a)), y = lum(rgb(b)); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
function hsl(h) {
  const [r, g, b] = rgb(h).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let hue = 0; if (d) hue = mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return [(hue + 360) % 360, s, l];
}

test('every text and control pair meets AA contrast in all six themes', async () => {
  const { THEMES, PAIRS, LOOKS } = await import('../src/ui/tokens.js');
  assert.deepEqual(LOOKS, ['graphite', 'porcelain', 'ocean', 'ink', 'plum', 'midnight']);
  const bad = [];
  for (const look of LOOKS) for (const [fg, bg, min, what] of PAIRS) {
    const t = THEMES[look]; assert.ok(t[fg] && t[bg], look + ': ' + fg + ' or ' + bg + ' missing');
    const r = ratio(t[fg], t[bg]); if (r < min) bad.push(look + ' ' + fg + ' on ' + bg + ' (' + what + ') ' + r.toFixed(2) + ' < ' + min);
  }
  assert.deepEqual(bad, []);
});
test('class colours stand out from the page as a dot or rule (3:1)', async () => {
  const { THEMES, LOOKS } = await import('../src/ui/tokens.js');
  for (const look of LOOKS) for (const c of THEMES[look].cls) assert.ok(ratio(c, THEMES[look].s) >= 3, look + ' class colour ' + c);
});
test('red only for marks; check marks green; no sage or yellow-green', async () => {
  const { THEMES, LOOKS } = await import('../src/ui/tokens.js');
  for (const look of LOOKS) {
    const t = THEMES[look];
    const all = Object.entries(t).flatMap(([k, v]) => k === 'cls' ? v.map((c, i) => ['c' + (i + 1), c]) : typeof v === 'string' && /^#[0-9A-F]{6}$/i.test(v) ? [[k, v]] : []);
    for (const [k, v] of all) {
      const [h, s] = hsl(v);
      if (s > .35 && (h >= 345 || h <= 15)) assert.equal(k, 'pen', look + ' ' + k + ' ' + v + ' is red: red is only for marks');
      if (s > .15) assert.ok(!(h > 55 && h < 115), look + ' ' + k + ' ' + v + ' is yellow-green or sage');
    }
    const [hok] = hsl(t.ok); assert.ok(hok > 120 && hok < 170, look + ' ok is green');
  }
});
test('no theme follows the computer: prefers-color-scheme appears nowhere in the new app', () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(x => x.isDirectory() ? walk(path.join(d, x.name)) : [path.join(d, x.name)]);
  for (const f of [...walk(path.join(NEXT, 'src')), ...fs.readdirSync(NEXT).filter(f => f.endsWith('.html')).map(f => path.join(NEXT, f))])
    assert.ok(!/prefers-color-scheme/.test(fs.readFileSync(f, 'utf8')), path.relative(NEXT, f));
});
test('parts.css draws only with tokens, and never uses a not-for-text token as text', async () => {
  const { NOT_TEXT } = await import('../src/ui/tokens.js');
  const css = fs.readFileSync(path.join(NEXT, 'src/ui/parts.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const lit = css.match(/#[0-9a-f]{3,8}\b|\brgba?\((?!var\()|\boklch\(|\bhsla?\(/gi) || [];
  assert.deepEqual(lit, [], 'colour written into parts.css instead of a token');
  const kebab = k => k.replace(/[A-Z]/g, c => '-' + c.toLowerCase());
  for (const m of css.matchAll(/(?:^|[;{\s])color:\s*var\(--([\w-]+)\)/g)) assert.ok(!NOT_TEXT.map(kebab).includes(m[1]), '--' + m[1] + ' used for text');
});
