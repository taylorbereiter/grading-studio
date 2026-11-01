// Real WCAG contrast measurements of every piece of text on screen. Runs in the page; returns what falls short of AA.
// Skipped: papers and slides (their own colors), disabled controls (WCAG exempts them), and covered anonymous names.
function contrastFails() {
  const lin = c => { c /= 255; return c <= .03928 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); };
  const lum = c => .2126 * lin(c[0]) + .7152 * lin(c[1]) + .0722 * lin(c[2]);
  const parse = s => {
    const p = s.match(/[\d.]+/g).map(Number);
    if (p.length < 3 || p.some(isNaN)) throw new Error('Can’t read the color ' + s);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  };
  const over = (a, b) => [0, 1, 2].map(i => a[i] * a[3] + b[i] * (1 - a[3])).concat(1);
  const bgOf = el => {
    const st = [];
    for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c[3] > 0) { st.push(c); if (c[3] === 1) break; } }
    return st.reverse().reduce((b, c) => over(c, b), [255, 255, 255, 1]);
  };
  const out = new Map(), w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    const el = n.parentElement;
    if (!n.nodeValue.trim() || !el || /^(SCRIPT|STYLE|TITLE|OPTION|TEXTAREA)$/.test(el.tagName)) continue;
    if (el.closest('.dpage,.ls-slide,:disabled,.anonhide,.pg')) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
    const cs = getComputedStyle(el);
    let op = 1; for (let e = el; e; e = e.parentElement) op *= +getComputedStyle(e).opacity;
    if (op < .05) continue;
    const bg = bgOf(el), f = parse(cs.color); f[3] *= op;
    const a = lum(over(f, bg)), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    const size = parseFloat(cs.fontSize), large = size >= 24 || (size >= 18.66 && +cs.fontWeight >= 700), need = large ? 3 : 4.5;
    if (isNaN(ratio)) throw new Error('Couldn’t measure ' + n.nodeValue);
    if (ratio < need) out.set(el.tagName + '.' + el.className + ' ' + cs.color + ' on ' + bg.slice(0, 3).map(Math.round), { ratio: +ratio.toFixed(2), need, text: n.nodeValue.trim().slice(0, 30) });
  }
  // Placeholder words: inputs and text boxes that are empty, on screen.
  for (const el of document.querySelectorAll('input[placeholder],textarea[placeholder]')) {
    const r = el.getBoundingClientRect();
    if (el.value || el.disabled || !el.placeholder || !r.width || !r.height || !el.checkVisibility() || r.bottom < 0 || r.top > innerHeight) continue;
    const bg = bgOf(el), f = parse(getComputedStyle(el, '::placeholder').color), a = lum(over(f, bg)), b = lum(bg), ratio = (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
    if (ratio < 4.5) out.set('placeholder of ' + el.tagName + '#' + el.id + ' on ' + bg.slice(0, 3).map(Math.round), { ratio: +ratio.toFixed(2), need: 4.5, text: el.placeholder.slice(0, 30) });
  }
  return [...out].map(([where, v]) => ({ where, ...v }));
}
// How many pieces of text the scan actually looked at, so a broken scan can't pass by looking at nothing.
function contrastSeen() {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let c = 0; for (let n; (n = w.nextNode());) { const el = n.parentElement; if (n.nodeValue.trim() && el && el.getBoundingClientRect().width && el.checkVisibility() && !/^(SCRIPT|STYLE|TITLE)$/.test(el.tagName)) c++; }
  return c;
}
module.exports = { contrastFails, contrastSeen };
