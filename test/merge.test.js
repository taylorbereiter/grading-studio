// The merge function alone: no browser, no storage, no clock it isn't told about.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const SCALE12 = { 12: 100, 11: 95, 10: 91, 9: 86, 8: 82, 7: 77, 6: 73, 5: 68, 4: 64, 3: 60 };   // the app's own, which is in app.js
const M = vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'src', 'merge.js'), 'utf8') + ';({ mergeWork, mergeScan, mergeStates, mergeFiles, mergeEdits, mergeLib, mergeLs, stampData, revsOf, tabMerge, tabDiffers, stampLib, libPrev, recHash, decideRec, workVec, vJoin, snapKeep, canon, libLinked, libHold, libFollow, rubricsDiffer, workScored })', { SCALE12 });
const plain = v => JSON.parse(JSON.stringify(v));
const rec = (rubric, extra = {}) => ({ f: {}, g: { rubric, points: '', comment: '', ...(extra.g || {}) }, h: {}, ...extra.rec });
// A save on one computer: only what changed gets moved on, as the app does it.
function save(work, dev, now, change) {
  const prev = M.revsOf(work), data = plain(work || { s: {} });
  data.t = now; change(data);
  M.stampData(prev, data, dev, now);
  return data;
}
const base = () => save(null, 'lap', 1000, d => { d.s.Aria = rec([3, 3, 3]); d.s.Bram = rec([2, 2, 2]); });

test('only one side changed: that side wins, whatever the clocks say', () => {
  const b0 = base();
  const home = save(b0, 'home', 500, d => { d.s.Aria.g.rubric = [4, 4, 4]; });   // the home computer's clock is far behind
  const m = M.mergeWork(b0, home);
  assert.deepEqual(plain(m.work.s.Aria.g.rubric), [4, 4, 4]);
  assert.equal(m.rows.find(r => r.key === 'Aria').pick, 'b'); assert.equal(m.rows.find(r => r.key === 'Aria').by, 'order');
  assert.equal(m.toA, true);
  assert.equal(m.ask.length, 0);
  const back = M.mergeWork(home, b0);
  assert.deepEqual(plain(back.work.s.Aria.g.rubric), [4, 4, 4], 'and the other way round');
  assert.equal(back.toA, false);
});

test('newest wins per student: new work on one cannot erase work on another', () => {
  const b0 = base();
  const lap = save(b0, 'lap', 2000, d => { d.s.Bram.g.rubric = [1, 1, 1]; });
  const home = save(b0, 'home', 3000, d => { d.s.Aria.g.rubric = [4, 4, 4]; });
  const m = M.mergeWork(lap, home);
  assert.deepEqual(plain(m.work.s.Aria.g.rubric), [4, 4, 4]);
  assert.deepEqual(plain(m.work.s.Bram.g.rubric), [1, 1, 1]);
  assert.equal(m.ask.length, 0);
  assert.equal(m.toA, true); assert.equal(m.toB, true);
});

test('a cleared score is a change, and beats the older score', () => {
  const b0 = base();
  const lap = save(b0, 'lap', 2000, d => { d.s.Aria.g.rubric = [null, null, null]; });
  const m = M.mergeWork(lap, b0);
  assert.deepEqual(plain(m.work.s.Aria.g.rubric), [null, null, null]);
  const m2 = M.mergeWork(b0, lap);
  assert.equal(m2.rows.find(r => r.key === 'Aria').pick, 'b');
  assert.deepEqual(plain(m2.work.s.Aria.g.rubric), [null, null, null]);
});

test('every mark and score taken off a student still counts: the record stays, with nothing on it', () => {
  const w = save(null, 'lap', 1000, d => { d.s.Aria = { f: { 'Aria/a.pdf': { 0: [{ t: 'pen' }] } }, g: { rubric: [], points: '', comment: '' }, h: {} }; });
  const lap = save(w, 'lap', 2000, d => { delete d.s.Aria; });   // saveNow leaves an empty student out
  assert.ok(lap.s.Aria, 'kept'); assert.ok(lap.s.Aria.v); assert.equal(M.recHash(lap.s.Aria), '');
  const m = M.mergeWork(lap, w);
  assert.equal(m.rows[0].pick, 'a');
  assert.equal(M.recHash(m.work.s.Aria), '');
});

test('both changed since they last matched: she is asked, with both versions, and nothing is chosen', () => {
  const b0 = base();
  const lap = save(b0, 'lap', 2000, d => { d.s.Aria.g.comment = 'Laptop comment'; });
  const home = save(b0, 'home', 9000, d => { d.s.Aria.g.comment = 'Home comment'; });
  const m = M.mergeWork(lap, home);
  assert.equal(m.ask.length, 1);
  assert.equal(m.ask[0].key, 'Aria');
  assert.equal(m.ask[0].a.g.comment, 'Laptop comment'); assert.equal(m.ask[0].b.g.comment, 'Home comment');
  assert.equal(m.work.s.Aria.g.comment, 'Laptop comment', 'this side keeps its own until she decides');
});

test('her choice wins in both directions and does not come back as a question', () => {
  const b0 = base();
  const lap = save(b0, 'lap', 2000, d => { d.s.Aria.g.comment = 'Laptop'; });
  const home = save(b0, 'home', 3000, d => { d.s.Aria.g.comment = 'Home'; });
  const m = M.mergeWork(lap, home, { answers: { Aria: 'a' }, dev: 'lap', now: 4000 });
  assert.equal(m.ask.length, 0); assert.equal(m.work.s.Aria.g.comment, 'Laptop'); assert.equal(m.toB, true);
  const again = M.mergeWork(home, m.work);
  assert.equal(again.ask.length, 0, 'the chosen copy has seen both');
  assert.equal(again.work.s.Aria.g.comment, 'Laptop');
});

test('the same change on both sides is not a question', () => {
  const b0 = base();
  const lap = save(b0, 'lap', 2000, d => { d.s.Aria.g.rubric = [4, 4, 4]; });
  const home = save(b0, 'home', 3000, d => { d.s.Aria.g.rubric = [4, 4, 4]; });
  const m = M.mergeWork(lap, home);
  assert.equal(m.rows.find(r => r.key === 'Aria').pick, 'same');
  const next = save(m.work, 'lap', 4000, d => { d.s.Aria.g.comment = 'More'; });
  assert.equal(M.mergeWork(next, home).rows.find(r => r.key === 'Aria').pick, 'a', 'it has seen both now');
});

test('old records with no history: the later time wins, and a tie is asked about', () => {
  const a = { t: 1000, s: { Aria: rec([1]) } }, b = { t: 2000, s: { Aria: rec([2]) } };
  const m = M.mergeWork(a, b);
  assert.equal(m.rows[0].pick, 'b'); assert.equal(m.rows[0].by, 'date');
  assert.equal(M.mergeWork(b, a).rows[0].pick, 'a');
  const withTime = { t: 500, s: { Aria: rec([9], { g: { at: 3000 } }) } };
  assert.equal(M.mergeWork(withTime, b).rows[0].pick, 'a', 'a score has its own time, which counts for more than the download time');
  assert.equal(M.mergeWork({ t: 1000, s: { Aria: rec([1]) } }, { t: 1000, s: { Aria: rec([2]) } }).rows[0].pick, 'ask');
});

test('an old record first changed here is known to come after the old copy, even if the old copy has a later date', () => {
  const old = { t: 5000, s: { Aria: rec([1, 1, 1]), Bram: rec([2, 2, 2]) } };
  const lap = save(old, 'lap', 100, d => { d.s.Aria.g.rubric = [4, 4, 4]; });
  const m = M.mergeWork(lap, old);
  assert.equal(m.rows.find(r => r.key === 'Aria').pick, 'a'); assert.equal(m.rows.find(r => r.key === 'Aria').by, 'order');
  assert.equal(m.rows.find(r => r.key === 'Bram').pick, 'same');
});

test('blanks and key order do not count as a difference', () => {
  const x = { f: {}, g: { rubric: [3, null], points: '', comment: '', status: '' }, h: {}, L: undefined };
  const y = { h: {}, g: { comment: '', rubric: [3], points: '' }, f: { 'a.pdf': {} } };
  assert.equal(M.recHash(x), M.recHash(y));
  assert.notEqual(M.recHash(x), M.recHash({ ...y, g: { rubric: [3, 0] } }), 'a 0 is a score');
  assert.equal(M.recHash({ ...x, v: { a: 1 }, at: 9, g: { ...x.g, at: 5, atR: { 0: 1 } } }), M.recHash(x), 'stamps are not content');
});

test('per-file mark times move only for the file that changed', () => {
  const w = save(null, 'lap', 1000, d => { d.s.Aria = { f: { 'Aria/a.pdf': { 0: [{ t: 'pen' }] }, 'Aria/b.pdf': { 0: [{ t: 'hl' }] } }, g: { rubric: [] }, h: {} }; });
  const w2 = save(w, 'lap', 2000, d => { d.s.Aria.f['Aria/b.pdf'][0].push({ t: 'check' }); });
  assert.equal(w2.s.Aria.ft['Aria/a.pdf'], 1000); assert.equal(w2.s.Aria.ft['Aria/b.pdf'], 2000); assert.equal(w2.s.Aria.at, 2000);
});

test('marks wiped off a file move that file time too', () => {
  const w = save(null, 'lap', 1000, d => { d.s.Aria = { f: { 'Aria/a.pdf': { 0: [{ t: 'pen' }] } }, g: { rubric: [3] }, h: {} }; });
  const w2 = save(w, 'lap', 2000, d => { d.s.Aria.f = {}; });
  assert.equal(w2.s.Aria.ft['Aria/a.pdf'], 2000);
  assert.equal(M.mergeWork(w, w2).rows[0].pick, 'b');
});

test('a counter never goes backward, even with the clock set back', () => {
  const w = save(null, 'lap', 5000, d => { d.s.Aria = rec([1]); });
  const w2 = save(w, 'lap', 10, d => { d.s.Aria.g.rubric = [2]; });
  assert.ok(w2.s.Aria.v.lap > w.s.Aria.v.lap);
});

test('going back on purpose: the side she went back to wins everything, and is ahead of the other side after', () => {
  const b0 = base();
  const later = save(b0, 'lap', 2000, d => { d.s.Aria.g.comment = 'To be undone'; d.s.Cy = rec([1]); });
  const back = plain(b0);   // the browser went back to the earlier state, the folder still has the later one
  const m = M.mergeWork(back, later, { prefer: 'a', dev: 'lap', now: 3000 });
  assert.equal(m.work.s.Aria.g.comment, ''); assert.equal(M.recHash(m.work.s.Cy), '', 'someone who only existed later is blank');
  assert.equal(M.mergeWork(m.work, later).rows.every(r => r.pick === 'a' || r.pick === 'same'), true);
});

test('settings of the download: the changed copy wins, each setting on its own', () => {
  const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C'] }; d.s.Aria = rec([1]); });
  const a = save(b0, 'lap', 2000, d => { d.cls = 'c1'; });
  assert.equal(M.mergeWork(b0, a).work.cls, 'c1');
  assert.equal(M.mergeWork(a, b0).work.cls, 'c1');
  // A rubric row on one side and lighting on the other, whichever has the later time.
  const lap = save(b0, 'lap', 2000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C', 'D'] }; d.moved = { 'Pia/x.pdf': 'Nia' }; });
  const home = save(b0, 'home', 9000, d => { d.lightOpt = { on: true }; d.anon = { on: false, order: ['Aria'] }; });
  for (const m of [M.mergeWork(lap, home), M.mergeWork(home, lap)]) {
    assert.equal(m.ask.length, 0);
    assert.equal(m.work.setup.criteria.length, 4); assert.deepEqual(plain(m.work.moved), { 'Pia/x.pdf': 'Nia' }); assert.equal(m.work.lightOpt.on, true);
    assert.equal(m.toA, true); assert.equal(m.toB, true);
  }
  assert.deepEqual(plain(M.mergeWork(lap, home).setIn).sort(), ['anon', 'lightOpt'], 'what comes in is said');
  assert.deepEqual(plain(M.mergeWork(home, lap).setIn).sort(), ['moved', 'setup']);
  // and it stays settled on the next trip, both ways
  const m = M.mergeWork(lap, home), again = M.mergeWork(home, m.work);
  assert.equal(again.ask.length, 0); assert.equal(again.work.setup.criteria.length, 4); assert.equal(again.toB, false);
  assert.equal(M.mergeWork(m.work, again.work).toA, false);
});

test('settings: an old copy with no history still merges, and the later time decides what can’t be told apart', () => {
  const old = { t: 1000, s: {}, setup: { mode: 'points', outOf: 10 } };
  const lap = save(old, 'lap', 2000, d => { d.setup = { mode: 'points', outOf: 20 }; });
  assert.equal(M.mergeWork(lap, old).work.setup.outOf, 20, 'changed from the old one, so it comes after it');
  assert.equal(M.mergeWork(old, lap).work.setup.outOf, 20);
  assert.equal(M.mergeWork({ t: 1, s: {}, setup: { outOf: 1 } }, { t: 2, s: {}, setup: { outOf: 2 } }).work.setup.outOf, 2);
  assert.equal(M.mergeWork({ t: 1, s: {}, setup: { outOf: 1 } }, { t: 2, s: {}, setup: { outOf: 2 } }).ask.length, 0);
  // Copies from before settings had their own stamps: the whole-download order still counts.
  const ahead = { t: 5, sat: 5, sv: { lap: 5 }, s: {}, setup: { outOf: 5 } }, behind = { t: 9, sat: 9, sv: { lap: 3 }, s: {}, setup: { outOf: 3 } };
  assert.equal(M.mergeWork(behind, ahead).work.setup.outOf, 5);
});

test('settings changed on both sides: a real conflict is hers to choose, and the choice holds', () => {
  const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C'] }; });
  const lap = save(b0, 'lap', 2000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C', 'D'] }; });
  const home = save(b0, 'home', 9000, d => { d.setup = { mode: 'rubric', criteria: ['A'] }; });
  const m = M.mergeWork(lap, home);
  assert.equal(m.ask.length, 1); assert.equal(m.ask[0].part, 'setup');
  assert.equal(m.ask[0].a.criteria.length, 4); assert.equal(m.ask[0].b.criteria.length, 1);
  assert.equal(m.work.setup.criteria.length, 4, 'this side keeps its own until she decides');
  const p = M.mergeStates({ work: { d: lap }, meta: { d: {} } }, { work: { d: home }, meta: { d: {} } }).rows[0];
  assert.equal(p.kind, 'merge', 'a question counts as something to bring in');
  const ans = M.mergeWork(lap, home, { answers: { 'set:setup': 'a' }, dev: 'lap', now: 10000 });
  assert.equal(ans.work.setup.criteria.length, 4); assert.equal(ans.toB, true); assert.equal(ans.ask.length, 0);
  assert.equal(M.mergeWork(home, ans.work).work.setup.criteria.length, 4, 'and it doesn’t come back as a question');
  assert.equal(M.mergeWork(home, ans.work).ask.length, 0);
  // A download an assignment card opens, with no scores riding on it: there's nothing to choose, and its copy of the rubric goes by the card.
  for (const [card, len] of [[home, 1], [lap, 4]]) {
    const linked = M.mergeWork(lap, home, { linked: { setup: card.setup } });
    assert.equal(linked.ask.length, 0); assert.equal(linked.work.setup.criteria.length, len, 'the card’s');
  }
  // Only the grade spot differs: not worth a question.
  const sp = (t, spot) => save(b0, t === 2 ? 'lap' : 'home', t * 1000, d => { d.setup = { ...d.setup, spot }; });
  assert.equal(M.mergeWork(sp(2, { page: 'first' }), sp(3, { page: 'last' })).ask.length, 0);
  // Anonymous on one side and off on the other is asked; only a different shuffle isn't.
  const an = (dev, t, on) => save(b0, dev, t, d => { d.anon = { on, order: [dev] }; });
  assert.equal(M.mergeWork(an('lap', 2000, true), an('home', 3000, false)).ask[0].part, 'anon');
  assert.equal(M.mergeWork(an('lap', 2000, true), an('home', 3000, true)).ask.length, 0);
});

test('moved files, covers and lighting changed on both sides are pooled, and only one file going two ways is asked', () => {
  const b0 = save(null, 'lap', 1000, d => { d.s.Aria = rec([1]); });
  const lap = save(b0, 'lap', 2000, d => { d.moved = { 'A/x.pdf': 'Nia' }; d.share = { codes: { Aria: 'K1' }, boxes: { 'A/x.pdf|0': [[1, 1, 1, 1]] } }; d.light = { Aria: { b: 1 } }; });
  const home = save(b0, 'home', 3000, d => { d.moved = { 'B/y.pdf': 'Oren' }; d.share = { codes: { Bram: 'K2' }, boxes: { 'A/x.pdf|0': [[2, 2, 2, 2]] }, ask: 'Say more' }; d.light = { Bram: { b: 2 } }; });
  const m = M.mergeWork(lap, home);
  assert.equal(m.ask.length, 0);
  assert.deepEqual(plain(m.work.moved), { 'A/x.pdf': 'Nia', 'B/y.pdf': 'Oren' });
  assert.deepEqual(plain(m.work.share.codes), { Aria: 'K1', Bram: 'K2' });
  assert.equal(m.work.share.boxes['A/x.pdf|0'].length, 2, 'a name stays covered');
  assert.equal(m.work.share.ask, 'Say more');
  assert.deepEqual(plain(m.work.light), { Aria: { b: 1 }, Bram: { b: 2 } });
  assert.deepEqual(plain(m.setBoth.map(x => x.pooled)), [true, true, true]);
  const clash = save(b0, 'home', 3000, d => { d.moved = { 'A/x.pdf': 'Oren', 'C/z.pdf': 'Pia' }; });
  const q = M.mergeWork(lap, clash);
  assert.equal(q.ask.length, 1); assert.equal(q.ask[0].part, 'moved');
  assert.deepEqual(plain(M.mergeWork(lap, clash, { answers: { 'set:moved': 'b' } }).work.moved), { 'A/x.pdf': 'Oren', 'C/z.pdf': 'Pia' });
  assert.deepEqual(plain(M.mergeWork(lap, clash, { answers: { 'set:moved': 'a' } }).work.moved), { 'A/x.pdf': 'Nia', 'C/z.pdf': 'Pia' });
});

test('going back: the side she went back to wins every setting, and its page answers', () => {
  const b0 = save(null, 'lap', 1000, d => { d.setup = { outOf: 1 }; d.scan = { 'a.pdf': { rec: { 0: { didTurn: 180 } }, at: { 0: { r: 180 } } } }; });
  const later = save(b0, 'home', 2000, d => { d.setup = { outOf: 2 }; d.scan = { 'a.pdf': { rec: { 0: { didTurn: 180, off: { turn: 1 } } }, at: {} } }; });
  const m = M.mergeWork(b0, later, { prefer: 'a', dev: 'lap', now: 3000 });
  assert.equal(m.work.setup.outOf, 1); assert.equal(m.work.scan['a.pdf'].at[0].r, 180);
  assert.equal(M.mergeWork(later, m.work).work.setup.outOf, 1, 'and it stays ahead');
});

test('a Put back or an answer about a page travels, and a fix the other side made still stands where nobody put it back', () => {
  const lap = { 'a.pdf': { rec: { 0: { turn: 180, sure: 2, didTurn: 180 }, 1: { skew: 2, skewSure: 2, didSkew: 2 } }, at: { 0: { r: 180 }, 1: { k: 2 } } } };
  const home = { 'a.pdf': { rec: { 0: { turn: 180, sure: 2, didTurn: 180, off: { turn: 1 } }, 1: { skew: 2, skewSure: 2, didSkew: 2 }, 2: { blank: 1, off: { blank: 1 } } }, at: { 1: { k: 2 } } } };
  for (const [x, y] of [[lap, home], [home, lap]]) {
    const { scan } = M.mergeScan(x, y), f = scan['a.pdf'];
    assert.equal(f.at[0], undefined, 'put back stays put back');
    assert.equal(f.at[1].k, 2);
    assert.equal(f.rec[0].off.turn, 1); assert.equal(f.rec[2].off.blank, 1);
  }
  assert.equal(M.mergeScan(lap, home).her, 2, 'two pages have an answer from home');
  assert.equal(M.mergeScan(home, lap).her, 0);
  const b0 = save(null, 'lap', 1000, d => { d.scan = lap; });
  const p = M.mergeStates({ work: { d: b0 }, meta: { d: {} } }, { work: { d: { ...plain(b0), scan: home } }, meta: { d: {} } }).rows[0];
  assert.equal(p.kind, 'merge'); assert.deepEqual(plain(p.setIn), ['scan']);
  // Just looking at more pages is no reason to bring anything in.
  const looked = { 'a.pdf': { rec: { ...lap['a.pdf'].rec, 3: { faint: 1 } }, at: lap['a.pdf'].at } };
  const q = M.mergeStates({ work: { d: b0 }, meta: { d: {} } }, { work: { d: { ...plain(b0), scan: looked } }, meta: { d: {} } }).rows[0];
  assert.equal(q.kind, 'same'); assert.equal(q.toA, true, 'it still comes along');
});

test('scores read off the paper come along for Past work', () => {
  const a = { t: 1, s: {}, read: { Aria: { score: 8 } } }, b = { t: 1, s: {}, read: { Bram: { score: 7 }, Aria: { score: 1 } } };
  assert.deepEqual(plain(M.mergeWork(a, b).work.read), { Aria: { score: 8 }, Bram: { score: 7 } });
});

test('a forgotten download stays forgotten', () => {
  const b0 = base(), t = { t: 3000, name: 'River', v: M.vJoin(M.workVec(b0), { '!x:3000': 1 }) };
  const A = { work: {}, meta: {}, tomb: { x: t } }, B = { work: { x: b0 }, meta: { x: { id: 'x', name: 'River' } }, tomb: {} };
  const p = M.mergeStates(A, B);
  assert.equal(p.rows[0].kind, 'gone'); assert.equal(p.rows[0].onB, true); assert.equal(p.rows[0].onA, false);
  assert.ok(p.tomb.x);
  const p2 = M.mergeStates(B, A);
  assert.equal(p2.rows[0].kind, 'gone', 'in either direction'); assert.equal(p2.rows[0].onA, true);
});

test('work on the other copy after it was forgotten is asked about, not lost or brought back quietly', () => {
  const b0 = base(), t = { t: 3000, name: 'River', v: M.vJoin(M.workVec(b0), { '!x:3000': 1 }) };
  const home = save(b0, 'home', 2500, d => { d.s.Aria.g.comment = 'Done at home'; });
  const A = { work: {}, meta: {}, tomb: { x: t } }, B = { work: { x: home }, meta: { x: { id: 'x', name: 'River' } }, tomb: {} };
  const p = M.mergeStates(A, B);
  assert.equal(p.rows[0].kind, 'askGone'); assert.equal(p.asks[0].gone, true);
  const left = M.mergeStates(A, B, { answers: { '!x': 'gone' } });
  assert.equal(left.rows[0].kind, 'gone');
  const back = M.mergeStates(A, B, { answers: { '!x': 'back' }, dev: 'lap', now: 5000 });
  assert.equal(back.rows[0].kind, 'new'); assert.equal(back.rows[0].work.s.Aria.g.comment, 'Done at home');
  assert.equal(back.tomb.x, undefined);
  assert.equal(M.mergeStates({ work: {}, meta: {}, tomb: { x: t } }, { work: { x: back.rows[0].work }, meta: { x: { id: 'x', name: 'River' } } }).rows[0].kind, 'new', 'once back, the old tombstone has nothing to say');
});

test('opening a forgotten download again on purpose brings it back', () => {
  const b0 = base(), t = { t: 3000, name: 'River', v: M.vJoin(M.workVec(b0), { '!x:3000': 1 }) };
  const prev = M.revsOf(b0), again = plain(b0); again.t = 4000;
  M.stampData(prev, again, 'lap', 4000, t.v);
  const p = M.mergeStates({ work: { x: again }, meta: { x: { id: 'x', name: 'River' } }, tomb: {} }, { work: { x: b0 }, meta: { x: { id: 'x', name: 'River' } }, tomb: { x: t } });
  assert.equal(p.tomb.x, undefined); assert.notEqual(p.rows[0].kind, 'gone');
});

test('a late file taken off stays off, unless it is added again after', () => {
  assert.deepEqual(plain(M.mergeFiles({ 'A|a.pdf': 10 }, {}, {}, {})), { fromB: [], fromA: ['A|a.pdf'], dropA: [], dropB: [] });
  assert.deepEqual(plain(M.mergeFiles({}, { 'A|a.pdf': 10 }, {}, {})), { fromB: ['A|a.pdf'], fromA: [], dropA: [], dropB: [] });
  assert.deepEqual(plain(M.mergeFiles({}, { 'A|a.pdf': 10 }, { 'A|a.pdf': 20 }, {})).dropB, ['A|a.pdf'], 'taken off here after it was added');
  assert.deepEqual(plain(M.mergeFiles({}, { 'A|a.pdf': 30 }, { 'A|a.pdf': 20 }, {})).fromB, ['A|a.pdf'], 'added again after that');
  assert.deepEqual(plain(M.mergeFiles({ 'A|a.pdf': 10 }, {}, {}, { 'A|a.pdf': 20 })).dropA, ['A|a.pdf']);
});

test('Word edits follow whichever copy of the student won', () => {
  const rows = [{ key: 'Aria', pick: 'b' }, { key: 'Bram', pick: 'a' }, { key: 'Cy', pick: 'ask' }];
  const work = { s: { Aria: { v: { x: 1 } }, Bram: { v: { x: 1 } } } };
  const e = M.mergeEdits({ 'Aria/a.docx': 1, 'Bram/b.docx': 2, 'Cy/c.docx': 3 }, { 'Aria/a.docx': 5, 'Bram/b.docx': 6, 'Cy/c.docx': 4 }, work, rows);
  assert.deepEqual(plain(e.fromB), ['Aria/a.docx']); assert.deepEqual(plain(e.fromA), ['Bram/b.docx']);
  assert.deepEqual(plain(M.mergeEdits({ 'Aria/a.docx': 1 }, {}, work, rows).dropA), ['Aria/a.docx'], 'the winner had taken it off');
  const none = { fromB: [], fromA: [], dropA: [], dropB: [] };
  assert.deepEqual(plain(M.mergeEdits({}, { 'Cy/c.docx': 4 }, work, rows)), none, 'undecided: each place keeps its own');
  const her = [{ key: 'Aria', pick: 'a', by: 'her' }, { key: 'Bram', pick: 'b', by: 'her' }];
  assert.deepEqual(plain(M.mergeEdits({ 'Bram/b.docx': 2 }, { 'Aria/a.docx': 5 }, work, her)), { ...none, fromB: ['Aria/a.docx'], fromA: ['Bram/b.docx'] }, 'the one she picked may never have seen the other’s edit, so it stays');
});

test('Word edits on a loose file follow the student who won, as do edits on a moved file', () => {
  const rows = [{ key: 'Aria', pick: 'b' }, { key: 'Nia', pick: 'a' }], work = { s: { Aria: { v: { x: 1 } }, Nia: { v: { x: 1 } } }, moved: { 'Pia/m.docx': 'Nia' } };
  assert.deepEqual(plain(M.mergeEdits({ 'Aria.docx': 1 }, {}, work, rows).dropA), ['Aria.docx'], 'a loose file is its own student');
  assert.deepEqual(plain(M.mergeEdits({ 'Pia/m.docx': 1 }, { 'Pia/m.docx': 2 }, work, rows).fromA), ['Pia/m.docx']);
});

test('a Word edit she took off in the copy she picks stays off, and one that copy never saw stays on', () => {
  const her = [{ key: 'Dov', pick: 'a', by: 'her' }], none = { s: { Dov: { v: { x: 1 } } } };
  assert.deepEqual(plain(M.mergeEdits({}, { 'Dov/e.docx': 5 }, none, her).fromB), ['Dov/e.docx'], 'never seen here');
  const off = { ...none, gone: { '~edit|Dov/e.docx': 9 } };
  const e = M.mergeEdits({}, { 'Dov/e.docx': 5 }, off, her);
  assert.deepEqual(plain(e.dropB), ['Dov/e.docx']); assert.deepEqual(plain(e.fromB), []);
  assert.deepEqual(plain(M.mergeEdits({}, { 'Dov/e.docx': 12 }, off, her).fromB), ['Dov/e.docx'], 'made again after that');
});

test('a late file or reading replaced under the same name goes across, the later one both ways', () => {
  const k = 'A|a.pdf';
  assert.deepEqual(plain(M.mergeFiles({ [k]: 10 }, { [k]: 20 }, {}, {})).fromB, [k]);
  assert.deepEqual(plain(M.mergeFiles({ [k]: 20 }, { [k]: 10 }, {}, {})).fromA, [k]);
  assert.deepEqual(plain(M.mergeFiles({ [k]: 0 }, { [k]: 20 }, {}, {})).fromB, [], 'no date to go on: nothing moves');
  assert.deepEqual(plain(M.mergeFiles({ [k]: 10 }, { [k]: 10 }, {}, {})), { fromB: [], fromA: [], dropA: [], dropB: [] });
});

test('the Word document for a download, replaced later on the other side, comes in; an old one stays', () => {
  const doc = (name, at) => JSON.stringify({ name, b64: 'eA==', at });
  assert.equal(M.mergeLs({ 'gs.rd.x': doc('old', 5) }, { 'gs.rd.x': doc('new', 9) })['gs.rd.x'], doc('new', 9));
  assert.equal(M.mergeLs({ 'gs.rd.x': doc('new', 9) }, { 'gs.rd.x': doc('old', 5) })['gs.rd.x'], undefined);
  assert.equal(M.mergeLs({ 'gs.rd.x': JSON.stringify({ name: 'older', b64: 'eA==' }) }, { 'gs.rd.x': JSON.stringify({ name: 'older too', b64: 'eQ==' }) })['gs.rd.x'], undefined, 'no date on either: this one stays');
});

test('a saved rubric that was deleted stays deleted, unless it was saved again after', () => {
  const r = (id, at) => ({ id, name: id, at, criteria: ['One'] });
  const here = { 'gs.rubrics': JSON.stringify([r('r1', 1)]), 'gs.rubricsGone': JSON.stringify({ r2: 5 }) }, there = { 'gs.rubrics': JSON.stringify([r('r1', 1), r('r2', 2)]) };
  assert.deepEqual(plain(M.mergeLs(here, there)), {}, 'an older copy doesn’t bring it back');
  const back = M.mergeLs(there, here);
  assert.deepEqual(JSON.parse(back['gs.rubrics']).map(x => x.id), ['r1'], 'and the delete reaches the other computer');
  assert.deepEqual(JSON.parse(back['gs.rubricsGone']), { r2: 5 });
  assert.deepEqual(JSON.parse(M.mergeLs(here, { 'gs.rubrics': JSON.stringify([r('r2', 9)]) })['gs.rubrics']).map(x => x.id).sort(), ['r1', 'r2'], 'saved again after');
  assert.deepEqual(JSON.parse(M.mergeLs({ 'gs.rubrics': JSON.stringify([r('r2', 2)]) }, { 'gs.rubricsGone': JSON.stringify({ r2: 5 }) })['gs.rubrics']), [], 'the last one, with none left there');
});

const L = (names, extra) => ({ classes: [{ id: 'c1', name: '9A', names, units: [] }], loose: { id: '', units: [] }, units: [], ...extra });
const stamped = (l, dev, now, was) => { const c = plain(l); M.stampLib(c, was ? M.libPrev(was) : new Map(), dev, now); return c; };

test('rosters: an old backup with a different roster adds names and never replaces them', () => {
  const m = M.mergeLib(L(['Aria', 'Bram']), L(['Aria', 'Cy']));
  assert.deepEqual(plain(m.lib.classes[0].names), ['Aria', 'Bram', 'Cy']);
  assert.deepEqual(plain(m.notes[0].add), ['Cy']); assert.equal(m.notes[0].both, true);
});

const card = (extra) => ({ classes: [{ id: 'c1', name: '9A', names: [], units: [{ id: 'u1', name: 'One', items: [{ id: 'i1', name: 'Essay', classId: 'c1', setup: { criteria: ['A', 'B', 'C'] }, batchId: 'gs.b.old', ...extra }] }] }], loose: { id: '', units: [] }, units: [] });
const itemOf = l => l.classes[0].units[0].items[0];
const changed = (was, dev, now, ch) => { const c = plain(was); ch(itemOf(c)); M.stampLib(c, M.libPrev(was), dev, now); return c; };

test('just opening an assignment card isn’t a change to it', () => {
  const was = stamped(card(), 'lap', 1000);
  const lap = changed(was, 'lap', 2000, it => { it.setup = { criteria: ['A', 'B', 'C', 'D'] }; });
  const home = changed(was, 'home', 9000, it => { it.opened = 9000; });
  assert.equal(home.classes[0].units[0].items[0].v.home, undefined, 'no stamp from opening it');
  for (const m of [M.mergeLib(lap, home), M.mergeLib(home, lap)]) {
    assert.equal(itemOf(m.lib).setup.criteria.length, 4);
    assert.equal(itemOf(m.lib).opened, 9000, 'it still says when it was last opened');
  }
  const newer = changed(was, 'lap', 2000, it => { it.batchId = 'gs.b.new'; });
  assert.equal(itemOf(M.mergeLib(newer, home).lib).batchId, 'gs.b.new', 'nor does it send the card back to an older copy');
  assert.deepEqual(plain(M.mergeLib(newer, home).notes), []);
});

test('a card changed on both computers keeps both changes, field by field, and says when both changed the same thing', () => {
  const was = stamped(card(), 'lap', 1000);
  const lap = changed(was, 'lap', 2000, it => { it.setup = { criteria: ['A', 'B', 'C', 'D'] }; });
  const home = changed(was, 'home', 9000, it => { it.name = 'River essay'; });
  for (const m of [M.mergeLib(lap, home), M.mergeLib(home, lap)]) {
    assert.equal(itemOf(m.lib).setup.criteria.length, 4); assert.equal(itemOf(m.lib).name, 'River essay');
  }
  const m = M.mergeLib(lap, home);
  assert.ok(m.notes.some(n => n.kind === 'changed' && n.name === 'River essay'));
  const again = M.mergeLib(home, m.lib);
  assert.equal(itemOf(again.lib).setup.criteria.length, 4); assert.equal(itemOf(again.lib).name, 'River essay');
  const both = changed(was, 'home', 9000, it => { it.setup = { criteria: ['A'] }; });
  const n = M.mergeLib(lap, both, { dev: 'lap', now: 10000 });
  assert.equal(n.asks.length, 1, 'its rubric decides the grades, so she’s asked');
  const q = n.asks[0];
  assert.equal(q.part, 'setup'); assert.equal(q.key, 'set:setup'); assert.equal(q.name, 'Essay');
  assert.equal(q.a.criteria.length, 4); assert.equal(q.b.criteria.length, 1); assert.equal(q.tb, 9000); assert.equal(q.ta, 2000);
  assert.equal(itemOf(n.lib).setup.criteria.length, 4, 'this side keeps its own until she decides');
  assert.ok(!n.notes.some(x => x.rubric), 'and nothing says the later one was kept');
  assert.equal(M.mergeLib(n.lib, both).asks.length, 1, 'she can leave it for later, and it’s still a question');
  for (const [side, len] of [['a', 4], ['b', 1]]) {
    const ans = M.mergeLib(lap, both, { dev: 'lap', now: 10000, answers: { [q.id]: { 'set:setup': side } } });
    assert.equal(ans.asks.length, 0); assert.equal(itemOf(ans.lib).setup.criteria.length, len); assert.equal(ans.cards[q.id], side);
    for (const other of [lap, both]) {
      const again = M.mergeLib(other, ans.lib);
      assert.equal(again.asks.length, 0, 'and it doesn’t come back'); assert.equal(itemOf(again.lib).setup.criteria.length, len);
    }
  }
  // Only the name changed in both places: the later one, and she’s told.
  const a2 = changed(was, 'lap', 2000, it => { it.name = 'One'; }), b2 = changed(was, 'home', 9000, it => { it.name = 'Two'; });
  const o = M.mergeLib(a2, b2);
  assert.equal(o.asks.length, 0); assert.equal(itemOf(o.lib).name, 'Two'); assert.ok(o.notes.some(x => x.kind === 'both'));
  // Going back on purpose asks nothing.
  assert.equal(M.mergeLib(lap, both, { prefer: 'a', dev: 'lap', now: 10000 }).asks.length, 0);
});

test('a download follows the answer about its card’s rubric, and says nothing false before she gives it', () => {
  const was = stamped(card(), 'lap', 1000);
  const lap = changed(was, 'lap', 2000, it => { it.batchId = 'd'; it.setup = { criteria: ['A', 'B', 'C', 'D'] }; });
  const home = changed(was, 'home', 9000, it => { it.batchId = 'd'; it.setup = { criteria: ['A'] }; });
  const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B'] }; });
  const wl = save(b0, 'lap', 2000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C', 'D'] }; });
  const wh = save(b0, 'home', 9000, d => { d.setup = { mode: 'rubric', criteria: ['A'] }; });
  const st = w => ({ work: { d: w }, meta: { d: {} } });
  const m = M.mergeLib(lap, home, { dev: 'lap', now: 10000 }), id = m.asks[0].id;
  assert.equal(m.asks[0].batchId, 'd');
  assert.equal(M.libLinked(m.lib, m.cards).get('d'), 'ask');
  const wait = M.mergeStates(st(wl), st(wh), { linked: M.libLinked(m.lib, m.cards), dev: 'lap', now: 10000 }).rows[0];
  assert.equal(wait.ask.length, 0, 'there’s one question, about the card');
  assert.deepEqual(plain(wait.setIn), []); assert.deepEqual(plain(wait.setBoth), []);
  assert.equal(wait.work.setup.criteria.length, 4);
  for (const [side, len] of [['a', 4], ['b', 1]]) {
    const ans = M.mergeLib(lap, home, { dev: 'lap', now: 10000, answers: { [id]: { 'set:setup': side } } });
    const r = M.mergeStates(st(wl), st(wh), { linked: M.libLinked(ans.lib, ans.cards), dev: 'lap', now: 10000 }).rows[0];
    assert.equal(r.work.setup.criteria.length, len); assert.equal(r.ask.length, 0); assert.deepEqual(plain(r.setBoth), []);
    assert.equal(M.mergeWork(wh, r.work).work.setup.criteria.length, len, 'and it stays settled');
    assert.equal(M.mergeWork(wl, r.work).ask.length, 0);
  }
  // A card nobody has a question about, and a download with no card, are as they were.
  assert.equal(M.libLinked(lap).get('d').setup.criteria.length, 4); assert.equal(M.libLinked(lap).has('x'), false);
  assert.equal(M.mergeStates(st(wl), st(wh), { linked: new Map() }).rows[0].ask.length, 1);
  assert.equal(M.mergeStates(st(wl), st(wh)).rows[0].ask.length, 1);
});

test('a rubric only counts as different if it would change a total or a percent', () => {
  const R = (...c) => ({ mode: 'rubric', criteria: c });
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), R('X', 'Y', 'Z')), false, 'row names don’t');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), { ...R('A', 'B', 'C'), levels: [['none']] }), false, 'nor what each score means');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), { ...R('A', 'B', 'C'), scale: SCALE12, outOf: 30 }), false, 'nor filling in the usual scale, nor an out of that isn’t used');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), R('A', 'B', 'C', 'D')), true, 'rows do');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), { ...R('A', 'B', 'C'), scale: { ...SCALE12, 9: 85 } }), true, 'and a scale that’s used');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C', 'D'), { ...R('A', 'B', 'C', 'D'), scale: { ...SCALE12, 9: 85 } }), false, 'but not one for another total');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C'), { ...R('A', 'B', 'C'), scale: null }), true, 'No scale against the usual scale on 12 points is a different percent');
  assert.equal(M.rubricsDiffer({ mode: 'points', outOf: 12, scale: null }, { mode: 'points', outOf: 12, scale: SCALE12 }), true, 'on points out of 12 as well');
  assert.equal(M.rubricsDiffer(R('A', 'B', 'C', 'D'), { ...R('A', 'B', 'C', 'D'), scale: null }), false, 'with 16 points the usual scale isn’t used, so No scale changes nothing');
  assert.equal(M.rubricsDiffer({ mode: 'points', outOf: 10, scale: null }, { mode: 'points', outOf: 10 }), false, 'nor on points out of 10');
  assert.equal(M.rubricsDiffer({ mode: 'points', outOf: 10 }, { mode: 'points', outOf: 12 }), true);
  assert.equal(M.rubricsDiffer({ mode: 'points', outOf: 12 }, R('A', 'B', 'C')), true, 'a total and rows keep different scores');
  assert.equal(M.workScored({ s: { a: rec([], { g: { status: 'missing', points: 3 } }) } }), false, 'missing has no number');
  assert.equal(M.workScored({ s: { a: rec([null, 2]) } }), true);
  assert.equal(M.workScored({ s: { a: rec([], { g: { points: 0 } }) } }), true, 'a score of 0 counts');
  assert.equal(M.workScored({ s: {} }), false);
});

test('a card’s rubric and its download’s: whatever would change a grade is asked, and the answer settles both', () => {
  const R = (...c) => ({ mode: 'rubric', criteria: c }), three = R('A', 'B', 'C'), four = R('A', 'B', 'C', 'D');
  const scored = (d) => { d.s = { Nia: rec([3, 3, 3]) }; };
  const b0 = save(null, 'lap', 1000, d => { d.setup = three; scored(d); });
  const withRow = save(b0, 'home', 2000, d => { d.setup = four; }), renamed = save(b0, 'lap', 3000, d => { d.setup = R('Thesis', 'B', 'C'); });
  const on = setup => ({ linked: { setup }, dev: 'lap', now: 10000 });
  // The newer copy is the card's: the everyday case, with nothing to ask.
  for (const [a, b] of [[withRow, b0], [b0, withRow]]) {
    const m = M.mergeWork(a, b, on(four));
    assert.equal(m.ask.length, 0); assert.equal(m.work.setup.criteria.length, 4);
  }
  // The newer copy isn't the card's: no guessing either way, and this copy keeps its own until she says.
  for (const [a, b, here] of [[withRow, b0, 4], [b0, withRow, 3]]) {
    const m = M.mergeWork(a, b, on(three));
    assert.equal(m.ask.length, 1, 'she’s asked'); assert.equal(m.ask[0].part, 'setup'); assert.equal(m.work.setup.criteria.length, here);
    assert.equal(m.setIn.length, 0, 'and the preview doesn’t say it comes in'); assert.equal(m.setBoth.length, 0, 'or that the later one is kept');
  }
  // Each changed it, whatever the card says.
  const home2 = save(b0, 'home', 4000, d => { d.setup = four; });
  const lap2 = save(b0, 'lap', 3000, d => { d.setup = R('A'); });
  for (const su of [four, R('A'), three]) assert.equal(M.mergeWork(lap2, home2, on(su)).ask.length, 1);
  // Only a name differs: no grade changes, so nothing's asked, and the copy kept is the card's, not the later one.
  const m = M.mergeWork(renamed, withRowName(b0), on(R('Thesis', 'B', 'C')));
  assert.equal(m.ask.length, 0); assert.equal(m.work.setup.criteria[0], 'Thesis'); assert.equal(m.setBoth.length, 0);
  // Nothing scored: nothing to change, and the card's stands.
  const none = d => { d.s = {}; }, e0 = save(null, 'lap', 1000, d => { d.setup = three; none(d); });
  const e1 = save(e0, 'home', 2000, d => { d.setup = four; }), e2 = save(e0, 'lap', 3000, d => { d.setup = R('A'); });
  const n = M.mergeWork(e2, e1, on(four));
  assert.equal(n.ask.length, 0); assert.equal(n.work.setup.criteria.length, 4);
  // Her answer: the download takes it, the card follows, and neither comes back as a question.
  const card = () => ({ classes: [{ id: 'c', name: 'C', names: [], units: [{ id: 'u', name: 'U', items: [{ id: 'i', name: 'Essay', classId: 'c', batchId: 'd', setup: three, v: { lap: 5 }, at: 5 }] }] }] });
  const st = w => ({ work: { d: w }, meta: { d: {} } }), itemOf = l => l.classes[0].units[0].items[0];
  for (const [side, len] of [['a', 4], ['b', 3]]) {
    const libm = M.mergeLib(card(), card(), { dev: 'lap', now: 10000 });
    assert.equal(M.libLinked(libm.lib, libm.cards).get('d').setup.criteria.length, 3);
    const open = M.mergeStates(st(withRow), st(b0), { linked: M.libLinked(libm.lib, libm.cards), dev: 'lap', now: 10000 });
    assert.equal(open.asks.length, 1); assert.equal(open.asks[0].id, 'd');
    M.libFollow(libm, open.rows, 'lap', 10000);
    assert.equal(itemOf(libm.lib).setup.criteria.length, 3, 'nothing moves until she answers');
    const plan = M.mergeStates(st(withRow), st(b0), { answers: { d: { 'set:setup': side } }, linked: M.libLinked(libm.lib, libm.cards), dev: 'lap', now: 10000 });
    assert.equal(plan.asks.length, 0); assert.equal(plan.rows[0].work.setup.criteria.length, len);
    M.libFollow(libm, plan.rows, 'lap', 10000);
    assert.equal(itemOf(libm.lib).setup.criteria.length, len, 'and the card goes with it');
    assert.equal(libm.toA, side === 'a');
    const after = M.mergeStates(st(plan.rows[0].work), st(b0), { linked: M.libLinked(libm.lib) });
    assert.equal(after.asks.length, 0, 'settled'); assert.equal(after.rows[0].cardOff, false);
    assert.equal(M.mergeLib(card(), libm.lib, { dev: 'home', now: 11000 }).asks.length, 0);
    assert.equal(itemOf(M.mergeLib(card(), libm.lib, { dev: 'home', now: 11000 }).lib).setup.criteria.length, len);
  }
  // Both copies the same and the card different, as old work can be: nothing to settle here, and the preview can say so.
  const same = M.mergeStates(st(withRow), st(withRow), { linked: new Map([['d', { setup: three }]]) });
  assert.equal(same.asks.length, 0); assert.equal(same.rows[0].cardOff, true);
  function withRowName(w) { return save(w, 'home', 2500, d => { d.setup = R('Claim', 'B', 'C'); }); }
});

test('an old card’s rubric changed in both places, with no stamps to go by, is still hers to choose', () => {
  const lib = (criteria, at) => ({ classes: [{ id: 'c', name: 'C', names: [], units: [{ id: 'u', name: 'U', items: [{ id: 'i', name: 'Essay', classId: 'c', setup: { mode: 'rubric', criteria }, at }] }] }] });
  const m = M.mergeLib(lib(['A', 'B', 'C'], 1000), lib(['A', 'B', 'C', 'D'], 2000), { dev: 'lap', now: 10000 });
  assert.equal(m.asks.length, 1); assert.ok(!m.notes.some(n => n.rubric), 'nothing says the later one is kept');
  assert.equal(m.lib.classes[0].units[0].items[0].setup.criteria.length, 3);
});

test('a library held for a question has the other copy’s card, and only that', () => {
  const l = { classes: [{ id: 'c', name: 'C', names: [], units: [{ id: 'u', name: 'U', items: [{ id: 'i1', name: 'Mine', setup: { criteria: ['A'] } }, { id: 'i2', name: 'Other' }] }] }] };
  const out = JSON.parse(M.libHold(JSON.stringify(l), { i1: { id: 'i1', name: 'Theirs', v: { home: 5 } } }));
  assert.deepEqual(out.classes[0].units[0].items, [{ id: 'i1', name: 'Theirs', v: { home: 5 } }, { id: 'i2', name: 'Other' }]);
});

test('Claude codes made on both computers: each student keeps both, so a reply matches either way', () => {
  const b0 = save(null, 'lap', 1000, d => { d.s.Aria = rec([1]); });
  const lap = save(b0, 'lap', 2000, d => { d.share = { codes: { Aria: 'S-LLLL', Bram: 'S-LBBB' }, boxes: {}, sent: ['S-LLLL', 'S-LBBB'] }; });
  const home = save(b0, 'home', 3000, d => { d.share = { codes: { Aria: 'S-HHHH', Bram: 'S-HBBB', Cy: 'S-HCCC' }, boxes: {} }; });
  for (const [x, y] of [[lap, home], [home, lap]]) {
    const m = M.mergeWork(x, y, { dev: 'x', now: 5000 }), sh = m.work.share;
    assert.equal(m.ask.length, 0);
    assert.deepEqual(plain(sh.codes), { Aria: 'S-LLLL', Bram: 'S-LBBB', Cy: 'S-HCCC' }, 'the earlier ones go on being used');
    assert.deepEqual(plain(sh.also), { 'S-HHHH': 'Aria', 'S-HBBB': 'Bram' }, 'and the others still match');
    assert.deepEqual(plain(sh.sent), ['S-LLLL', 'S-LBBB']);
    assert.deepEqual(plain(m.setBoth), [{ k: 'share', pooled: true }]);
    assert.deepEqual(plain(M.mergeWork(lap, m.work).work.share.also), plain(sh.also), 'it goes across and stays');
    assert.deepEqual(plain(M.mergeWork(home, m.work).work.share.also), plain(sh.also));
  }
  // Merged twice over, from a third side: nothing is forgotten.
  const m = M.mergeWork(lap, home, { dev: 'x', now: 5000 }).work;
  const third = save(b0, 'desk', 6000, d => { d.share = { codes: { Aria: 'S-DDDD' }, boxes: {} }; });
  assert.deepEqual(plain(M.mergeWork(m, third, { dev: 'x', now: 7000 }).work.share.also), { 'S-HHHH': 'Aria', 'S-HBBB': 'Bram', 'S-DDDD': 'Aria' });
  // A ZIP was made from the later ones: those are the codes to go on showing.
  const zipped = save(b0, 'home', 3000, d => { d.share = { codes: { Aria: 'S-HHHH', Bram: 'S-HBBB' }, boxes: {}, made: 3000 }; });
  const z = M.mergeWork(lap, zipped, { dev: 'x', now: 5000 }).work.share;
  assert.deepEqual(plain(z.codes), { Aria: 'S-HHHH', Bram: 'S-HBBB' }); assert.deepEqual(plain(z.also), { 'S-LLLL': 'Aria', 'S-LBBB': 'Bram' });
  // Only one side made codes: nothing to keep, nothing added.
  const none = save(b0, 'home', 3000, d => { d.share = { boxes: { 'a|0': [[1, 1, 1, 1]] } }; });
  const one = M.mergeWork(lap, none, { dev: 'x', now: 5000 }).work.share;
  assert.deepEqual(plain(one.codes), plain(lap.share.codes)); assert.equal(one.also, undefined); assert.equal(one.boxes['a|0'].length, 1);
  // The same code on two students, by chance: it can’t be trusted for either, and no wrong student is ever matched.
  const c1 = save(b0, 'lap', 2000, d => { d.share = { codes: { Aria: 'S-SAME', Bram: 'S-LBBB' }, boxes: {} }; });
  const c2 = save(b0, 'home', 3000, d => { d.share = { codes: { Aria: 'S-HHHH', Bram: 'S-SAME' }, boxes: {} }; });
  const sh = M.mergeWork(c1, c2, { dev: 'x', now: 5000 }).work.share;
  assert.deepEqual(plain(sh.codes), { Bram: 'S-LBBB' }, 'Aria gets a new one when it’s next needed');
  assert.deepEqual(plain(sh.also), { 'S-HHHH': 'Aria' });
});

test('a roster changed on one side and a class renamed on the other: a name taken off stays off', () => {
  const was = stamped(L(['Aria', 'Bram']), 'lap', 1000);
  const edit = (dev, now, ch) => { const c = plain(was); ch(c.classes[0]); M.stampLib(c, M.libPrev(was), dev, now); return c; };
  const m = M.mergeLib(edit('lap', 2000, c => { c.names = ['Aria']; }), edit('home', 3000, c => { c.name = '9B'; }));
  assert.deepEqual(plain(m.lib.classes[0].names), ['Aria']); assert.equal(m.lib.classes[0].name, '9B');
});

test('rosters: a change on only one side wins, so taking a name off sticks', () => {
  const was = stamped(L(['Aria', 'Bram']), 'lap', 1000);
  const now = stamped({ ...was, classes: [{ ...was.classes[0], names: ['Aria'] }] }, 'lap', 2000, was);
  const m = M.mergeLib(was, now);
  assert.deepEqual(plain(m.lib.classes[0].names), ['Aria']);
  assert.deepEqual(plain(m.notes[0].drop), ['Bram']);
  assert.deepEqual(plain(M.mergeLib(now, was).lib.classes[0].names), ['Aria'], 'in either direction');
});

test('a brand-new browser, its starter classes give way to the real ones', () => {
  const fresh = { classes: [{ id: 'seedid', name: '12EL-1', names: [], units: [] }], loose: { id: '', units: [] }, units: [] };
  const real = { classes: [{ id: 'realid', name: '12 EL-1', names: ['Aria'], units: [{ id: 'u1', name: 'Poetry', items: [{ id: 'i1', name: 'Poem', classId: 'realid' }] }] }], loose: { id: '', units: [] }, units: [] };
  const m = M.mergeLib(fresh, real);
  assert.equal(m.lib.classes.length, 1); assert.equal(m.lib.classes[0].id, 'realid');
  assert.deepEqual(plain(m.lib.classes[0].names), ['Aria']);
  assert.equal(m.lib.classes[0].units[0].items[0].name, 'Poem');
  assert.equal(m.mapA.seedid, 'realid');
});

test('two real classes with the same name and different ids become one', () => {
  const a = { classes: [{ id: 'a1', name: '9A', names: ['Aria'], units: [] }], loose: { id: '', units: [] } };
  const b = { classes: [{ id: 'b1', name: '9A', names: ['Bram'], units: [{ id: 'u', name: 'U', items: [{ id: 'i', name: 'I', classId: 'b1' }] }] }], loose: { id: '', units: [] } };
  const m = M.mergeLib(a, b);
  assert.equal(m.lib.classes.length, 1); assert.equal(m.lib.classes[0].id, 'a1');
  assert.deepEqual(plain(m.lib.classes[0].names), ['Aria', 'Bram']);
  assert.equal(m.lib.classes[0].units[0].items[0].classId, 'a1'); assert.equal(m.mapB.b1, 'a1');
});

test('units and assignments are pooled, and a deleted one stays deleted', () => {
  const was = stamped({ classes: [{ id: 'c1', name: '9A', names: [], units: [{ id: 'u1', name: 'One', items: [{ id: 'i1', name: 'Essay', classId: 'c1' }] }] }], loose: { id: '', units: [] }, units: [] }, 'lap', 1000);
  const less = plain(was); less.classes[0].units[0].items = [];
  const del = stamped(less, 'lap', 2000, was);
  assert.ok(del.gone.i1, 'the delete is remembered');
  const m = M.mergeLib(del, was);
  assert.deepEqual(plain(m.lib.classes[0].units[0].items), [], 'it does not come back from the older copy');
  const m2 = M.mergeLib(was, del);
  assert.deepEqual(plain(m2.lib.classes[0].units[0].items), [], 'and the delete reaches the other copy');
  const more = plain(was); more.classes[0].units[0].items.push({ id: 'i2', name: 'Quiz', classId: 'c1' });
  const m3 = M.mergeLib(del, stamped(more, 'home', 3000, was));
  assert.deepEqual(plain(m3.lib.classes[0].units[0].items).map(i => i.name), ['Quiz'], 'and something new from the other side comes in');
  assert.ok(m3.notes.some(n => n.kind === 'newItem' && n.name === 'Quiz'));
});

test('other saved things: comments are pooled, and nothing she has here is replaced', () => {
  const set = M.mergeLs({ 'gs.bank': '["One"]', 'gs.setup': '{"mode":"rubric"}' }, { 'gs.bank': '["One","Two"]', 'gs.setup': '{"mode":"points"}', 'gs.rp.a': '"x"', 'gs.lib': '{}', 'gs.rd.gone': '"y"' }, k => k.includes('gone'));
  assert.deepEqual(plain(set), { 'gs.bank': '["One","Two"]', 'gs.rp.a': '"x"' });
});

test('old snapshots thin out: the last 2 weeks all stay, then one a week, then none', () => {
  const DAY = 864e5, now = 1000 * DAY, list = [];
  for (let i = 0; i < 120; i++) list.push({ name: 'd' + i, t: now - i * DAY, why: 'daily' });
  for (let i = 0; i < 15; i++) list.push({ name: 'm' + i, t: now - i * DAY, why: 'Before bringing work in' });
  const keep = M.snapKeep(list, now);
  for (let i = 0; i <= 14; i++) assert.ok(keep.has('d' + i));
  assert.ok(!keep.has('d110')); assert.ok(!keep.has('m10')); assert.ok(keep.has('m9'));
  const weekly = [...keep].filter(n => n[0] === 'd' && +n.slice(1) > 14);
  assert.ok(weekly.length >= 11 && weekly.length <= 13, 'one a week for 12 weeks: ' + weekly.length);
});

test('going back: the roster she went back to wins, and what only came later stays gone', () => {
  const c = names => ({ id: 'c1', name: '12EL-1', names, units: [{ id: 'u1', name: 'Unit', items: [] }] });
  const prevOf = l => M.libPrev(plain(l));
  const back = { classes: [c(['Aria', 'Bram', 'Cleo'])] }, later = plain(back);
  M.stampLib(back, prevOf({ classes: [] }), 'lap', 1000);
  Object.assign(later, plain(back));
  later.classes[0].names = ['Aria', 'Zed']; later.classes.push({ id: 'c2', name: 'Later class', names: ['Yan'], units: [] });
  M.stampLib(later, M.libPrev(back), 'home', 2000);
  assert.deepEqual(plain(M.mergeLib(back, later).lib.classes.find(x => x.id === 'c1').names), ['Aria', 'Zed'], 'without going back the newer one wins');
  const m = M.mergeLib(back, later, { prefer: 'a', dev: 'lap', now: 3000 });
  assert.deepEqual(plain(m.lib.classes.map(x => x.names)), [['Aria', 'Bram', 'Cleo']]);
  assert.ok(m.toB);
  const again = M.mergeLib(m.lib, later);   // the other computer's copy comes in afterward: the one she went back to is ahead of it
  assert.deepEqual(plain(again.lib.classes.map(x => x.names)), [['Aria', 'Bram', 'Cleo']]);
});

test('going back: a class deleted since returns, and stays', () => {
  const back = { classes: [{ id: 'c1', name: 'A', names: ['Aria'], units: [] }, { id: 'c2', name: 'B', names: ['Bram'], units: [] }] };
  M.stampLib(back, M.libPrev({ classes: [] }), 'lap', 1000);
  const later = plain(back); later.classes.pop();
  M.stampLib(later, M.libPrev(back), 'lap', 2000);
  assert.deepEqual(plain(M.mergeLib(back, later).lib.classes.map(x => x.id)), ['c1'], 'without going back it stays deleted');
  const m = M.mergeLib(back, later, { prefer: 'a', dev: 'lap', now: 3000 });
  assert.deepEqual(plain(m.lib.classes.map(x => x.id)), ['c1', 'c2']);
  assert.deepEqual(plain(M.mergeLib(later, m.lib).lib.classes.map(x => x.id).sort()), ['c1', 'c2'], 'and the old deletion can’t take it away again');
});

test('going back: late files and Word edits are what this side has, whichever way they differ', () => {
  const a = { work: { d: { t: 1, s: {} } }, meta: { d: {} }, added: { d: { 'Aria|old.txt': 5 } }, edits: { d: { 'Aria/old.docx': 7, 'Aria/both.docx': 7 } } };
  const b = { work: { d: { t: 2, s: {}, gone: { 'Aria|old.txt': 9 } } }, meta: { d: {} }, added: { d: { 'Aria|new.txt': 8 } }, edits: { d: { 'Aria/new.docx': 8, 'Aria/both.docx': 9 } } };
  const r = M.mergeStates(a, b, { prefer: 'a', dev: 'lap', now: 3000 }).rows[0];
  assert.deepEqual(plain(r.files), { fromB: [], fromA: ['Aria|old.txt'], dropA: [], dropB: ['Aria|new.txt'] });
  assert.deepEqual(plain(r.edits.fromB), []); assert.deepEqual(plain(r.edits.dropA), []);
  assert.deepEqual(plain(r.edits.dropB), ['Aria/new.docx']); assert.deepEqual(plain(r.edits.fromA).sort(), ['Aria/both.docx', 'Aria/old.docx']);
  assert.equal(r.work.gone, undefined, 'the file came back, so it isn’t marked as taken off');
  assert.equal(r.toB, true, 'and the folder hears about that');
  const usual = M.mergeStates(a, b, { dev: 'lap', now: 3000 }).rows[0];
  assert.deepEqual(plain(usual.files.fromB), ['Aria|new.txt'], 'an ordinary merge still brings files in');
  assert.deepEqual(plain(usual.files.dropA), ['Aria|old.txt'], 'and a file taken off stays off');
});

// Two tabs on one download. The one that's behind writes only what it changed, one student and one setting at a time.
test('a tab that is behind keeps its own setting and takes the other tab’s, stamps and all', () => {
  const start = save(null, 'lap', 1000, d => { d.s.Aria = rec([3, 3, 3]); d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C'] }; d.light = { b: 1 }; });
  const other = save(start, 'tabB', 2000, d => { d.setup = { mode: 'rubric', criteria: ['A', 'B', 'C', 'D'] }; });
  const was = M.revsOf(start);
  assert.equal(M.tabDiffers(was, other), true);
  assert.equal(M.tabDiffers(was, plain(start)), false, 'only stamps or nothing changed: no news');
  // This tab changes the lighting only.
  const data = plain(start); data.t = 3000; data.light = { b: 2 };
  M.stampData(was, data, 'tabA', 3000);
  const m = M.tabMerge(data, was, other);
  assert.equal(m.changed, true);
  assert.deepEqual(plain(m.data.setup.criteria), ['A', 'B', 'C', 'D'], 'the other tab’s rubric stays');
  assert.deepEqual(plain(m.data.light), { b: 2 }, 'and this tab’s lighting goes in');
  assert.deepEqual(plain(m.data.pv.setup), plain(other.pv.setup), 'the rubric keeps its stamp from the tab that changed it');
  assert.deepEqual(plain(m.data.pv.light), plain(data.pv.light));
  assert.equal(M.mergeWork(other, m.data).ask.length, 0, 'and it merges with the other tab’s copy without a question');
  // With nothing of its own, this tab changes nothing and carries the other's settings and stamps as they are.
  const idle = plain(start); idle.t = 3100; M.stampData(M.revsOf(start), idle, 'tabA', 3100);
  const n = M.tabMerge(idle, M.revsOf(start), other);
  assert.equal(n.changed, false);
  assert.deepEqual(plain(n.data.setup), plain(other.setup));
  assert.deepEqual(plain(n.data.pv), plain(other.pv));
});

// A row taken out on one computer moves the scores there, and a student scored on the other is still on the old rows.
const threeRows = ['Criterion 1', 'Criterion 2', 'Criterion 3'];
const rowsApart = () => {
  const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: threeRows }; d.s.Ann = rec([1, 3, 4]); });
  const lap = save(b0, 'lap', 2000, d => { d.s.Ben = rec([2, 3, 4]); d.s.Ben.g.atR = { 0: 11, 1: 22, 2: 33, points: 44 }; });
  const home = save(b0, 'home', 3000, d => { d.setup = { mode: 'rubric', criteria: threeRows.slice(1) }; d.s.Ann.g.rubric = [3, 4]; });
  return { lap, home };
};

test('a row taken out on one computer: scores from the other go by row and don’t shift, whichever way they’re brought in', () => {
  const { lap, home } = rowsApart();
  for (const [a, b, here] of [[home, lap, 'home'], [lap, home, 'lap']]) {
    const m = M.mergeWork(a, b, { dev: here, now: 9000 });
    assert.equal(m.ask.length, 0);
    assert.deepEqual(plain(m.work.setup.criteria), threeRows.slice(1));
    assert.deepEqual(plain(m.work.s.Ben.g.rubric), [3, 4], 'Ben, brought into ' + here);
    assert.deepEqual(plain(m.work.s.Ben.g.atR), { 0: 22, 1: 33, points: 44 }, 'each score keeps its time');
    assert.deepEqual(plain(m.work.s.Ann.g.rubric), [3, 4], 'Ann, who moved with the row');
    assert.deepEqual(plain(m.lined), ['Ben']);
    assert.equal(m.toA, true); assert.equal(m.toB, true);
  }
  // And it's settled: the copy that took it in now comes after both, so nothing shifts or asks when it goes on to the other.
  const one = M.mergeWork(home, lap, { dev: 'home', now: 9000 }).work;
  const two = M.mergeWork(lap, one, { dev: 'lap', now: 9500 });
  assert.equal(two.ask.length, 0);
  assert.deepEqual(plain(two.work.s.Ben.g.rubric), [3, 4]);
  assert.deepEqual(plain(two.lined), []);
});

test('a student changed on both computers across a row taken out: she sees each copy’s rows, and her pick goes by row', () => {
  const { lap, home } = rowsApart();
  const lap2 = save(lap, 'lap', 2500, d => { d.s.Ann.g.rubric = [1, 3, 2]; });
  const m = M.mergeWork(home, lap2, { dev: 'home', now: 9000 });
  const q = m.ask.find(x => x.key === 'Ann');
  assert.deepEqual(plain(q.ca), threeRows.slice(1)); assert.deepEqual(plain(q.cb), threeRows); assert.equal(q.off, false);
  const said = M.mergeWork(home, lap2, { dev: 'home', now: 9000, answers: { Ann: 'b' } });
  assert.deepEqual(plain(said.work.s.Ann.g.rubric), [3, 2]);
  assert.equal(said.ask.length, 0);
});

test('rows that only grew or were renamed don’t move any score, and neither does taking off the last row', () => {
  const pair = (crit) => {
    const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: threeRows }; });
    const lap = save(b0, 'lap', 2000, d => { d.s.Ben = rec([2, 3, 4]); });
    const home = save(b0, 'home', 3000, d => { d.setup = { mode: 'rubric', criteria: crit }; });
    return M.mergeWork(home, lap, { dev: 'home', now: 9000 });
  };
  for (const crit of [[...threeRows, 'Criterion 4'], ['Thesis', 'Evidence', 'Style'], ['Thesis', 'Criterion 2', 'Criterion 3'], threeRows.slice(0, 2)]) {
    const m = pair(crit);
    assert.equal(m.ask.length, 0, crit.join());
    assert.deepEqual(plain(m.work.s.Ben.g.rubric), [2, 3, 4], crit.join());
    assert.deepEqual(plain(m.lined), []);
  }
  // A row put in where one was taken out, and one renamed, can still be told apart when there's no doubt about what's left.
  const m = pair(['Criterion 2', 'Criterion 3', 'Voice']);
  assert.deepEqual(plain(m.work.s.Ben.g.rubric), [3, 4, null]);
});

test('a row taken out and another renamed can’t be told apart, so she’s asked, and only rows with a match come in', () => {
  const b0 = save(null, 'lap', 1000, d => { d.setup = { mode: 'rubric', criteria: threeRows }; });
  const lap = save(b0, 'lap', 2000, d => { d.s.Ben = rec([2, 3, 4]); });
  const home = save(b0, 'home', 3000, d => { d.setup = { mode: 'rubric', criteria: ['Evidence', 'Criterion 3'] }; });
  const m = M.mergeWork(home, lap, { dev: 'home', now: 9000 });
  const q = m.ask.find(x => x.key === 'Ben');
  assert.equal(q.off, true); assert.deepEqual(plain(q.cb), threeRows);
  assert.equal(m.work.s.Ben, undefined, 'nothing comes in until she says');
  const said = M.mergeWork(home, lap, { dev: 'home', now: 9000, answers: { Ben: 'b' } });
  assert.equal(said.ask.length, 0);
  assert.deepEqual(plain(said.work.s.Ben.g.rubric), [null, 4]);
});
