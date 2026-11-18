// MADE BY next/build.js FROM the grading page's source (next/tools/lift.js). Do not edit: change the source and build again.
/* eslint-disable */
import { maxPoints, percentFor } from './gcore.js';

// src/app/calc.js
function calcEval(src) {
  const s = String(src).replace(/[×xX*]/g, '*').replace(/[÷:]/g, '/').replace(/[−–]/g, '-').replace(/,(?=\d{3}\b)/g, '').replace(/\s+/g, '');
  let i = 0;
  const peek = () => s[i], eat = c => { if (s[i] === c) { i++; return true; } return false; };
  const FN = { sum: a => a.reduce((x, y) => x + y, 0), avg: a => a.reduce((x, y) => x + y, 0) / a.length, min: a => Math.min(...a), max: a => Math.max(...a), round: a => a.length > 1 ? Math.round(a[0] * 10 ** a[1]) / 10 ** a[1] : Math.round(a[0]), sqrt: a => Math.sqrt(a[0]) };
  function atom() {
    if (eat('(')) { const v = add(); if (!eat(')')) throw 0; return v; }
    if (eat('-')) return -power();
    if (eat('+')) return power();
    const m = /^[a-z]+/i.exec(s.slice(i));
    if (m) {
      const f = FN[m[0].toLowerCase()]; if (!f) throw 0; i += m[0].length;
      if (!eat('(')) throw 0; const args = [add()]; while (eat(',') || eat(';')) args.push(add()); if (!eat(')')) throw 0;
      return f(args);
    }
    const n = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i)); if (!n) throw 0; i += n[0].length;
    return +n[0];
  }
  function post() { let v = atom(); while (eat('%')) v /= 100; return v; }
  function power() { const v = post(); return eat('^') ? v ** power() : v; }
  function mul() { let v = power(); for (;;) { if (eat('*')) v *= power(); else if (eat('/')) v /= power(); else if (peek() === '(') v *= power(); else return v; } }
  function add() { let v = mul(); for (;;) { if (eat('+')) v += mul(); else if (eat('-')) v -= mul(); else return v; } }
  if (!s) return null;
  const v = add(); if (i < s.length || !isFinite(v)) throw 0;
  return v;
}
// src/app/calc.js
const calcFmt = v => v == null ? '' : String(+(+v).toFixed(4));
// src/app/calc.js
function calcKeyOf(e) {
  if (e.key === 'Enter' || e.code === 'NumpadEnter' || e.code === 'NumpadEqual') return '=';
  if (e.key === 'Escape') return 'Escape';
  if (e.code === 'Equal' || e.key === '=') return e.shiftKey ? '=' : '+';
  if (e.key.length === 1 && /[\d.+\-*/()^%x×÷]/.test(e.key)) return e.key;
  return null;
}
// src/app/calc.js
function stickerText(v) {
  const max = maxPoints(), pct = max ? percentFor(v) : null;
  return calcFmt(v) + (max ? '/' + calcFmt(max) : '') + (pct != null ? ' = ' + pct + '%' : '');
}
export { calcEval, calcFmt, calcKeyOf, stickerText };
