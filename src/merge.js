/* ---------------- merging two copies of her work: nothing here touches the page or storage ---------------- */
// Each student's record says which saves it has seen: rec.v = { device: counter }, moved on by every save that changes it. rec.at is when it last
// changed and rec.ft has one time per file. (st.grade.at and atR are the score's own times.) Old records have none of this and still merge.
// The two computers' clocks can disagree, so order comes from v: a copy that has seen everything the other has is the newer one, whatever the clocks say.
// If each has seen something the other hasn't, both changed since they last matched, and she's shown both. Times only break a tie the order can't,
// which is when an old record has no history to go on.
// An old record stands for its own content, as { '~hash': 1 }. Its first change keeps that entry, so the changed copy is known to come after the old one.
const mHash = s => {
  let h1 = 0x811c9dc5, h2 = 0x1234567;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 16777619); h2 = Math.imul(h2 ^ c, 2246822519); }
  return (h1 >>> 0).toString(36) + (h2 >>> 0).toString(36);
};
// The same content always comes out the same: keys sorted, and blanks, empty lists and empty objects gone, however each copy happened to write them.
function canon(v) {
  if (v == null || v === '') return undefined;
  if (Array.isArray(v)) {
    const a = v.map(canon);
    while (a.length && a[a.length - 1] === undefined) a.pop();
    return a.length ? a.map(x => x === undefined ? null : x) : undefined;
  }
  if (typeof v !== 'object') return v;
  const o = {};
  for (const k of Object.keys(v).sort()) { const x = canon(v[k]); if (x !== undefined) o[k] = x; }
  return Object.keys(o).length ? o : undefined;
}
const hashOf = v => { const c = canon(v); return c === undefined ? '' : mHash(JSON.stringify(c)); };
// A student's content, without the stamps that say when and where it changed.
function recHash(rec) {
  if (!rec) return '';
  const { v, at, ft, Lp, ...x } = rec;
  if (x.g) { const { at: a, atR, ...g } = x.g; x.g = g; }
  return hashOf(x);
}
const vGeq = (a, b) => Object.keys(b).every(k => (a[k] || 0) >= b[k]);
const vJoin = (a, b) => { const o = { ...a }; for (const k of Object.keys(b)) if (!(o[k] >= b[k])) o[k] = b[k]; return o; };
const vOf = rec => rec && rec.v ? rec.v : (h => h ? { ['~' + h]: 1 } : {})(recHash(rec));
const vBump = (v, dev, now) => ({ ...v, [dev]: Math.max((v[dev] || 0) + 1, now) });
// When this record last changed. t0, the whole download's time, stands in for a record too old to have its own.
function recTime(r, t0) {
  if (!r) return 0;
  const g = r.g || {}, all = [r.at, g.at, ...Object.values(g.atR || {}), ...Object.values(r.ft || {})].filter(Boolean);
  return all.length ? Math.max(...all) : t0 || 0;
}
// 'same', 'a' or 'b' (by: 'order' or 'date'), or 'ask'.
function decideRec(a, b, ta, tb) {
  const ha = recHash(a), hb = recHash(b);
  if (ha === hb) return { pick: 'same' };
  if (!ha && !(a && a.v)) return { pick: 'b', by: 'order' };   // nothing here yet
  if (!hb && !(b && b.v)) return { pick: 'a', by: 'order' };
  const va = vOf(a), vb = vOf(b), ge = vGeq(va, vb), le = vGeq(vb, va);
  if (ge && !le) return { pick: 'a', by: 'order' };
  if (le && !ge) return { pick: 'b', by: 'order' };
  if (a.v && b.v) return { pick: 'ask' };
  const x = recTime(a, ta), y = recTime(b, tb);
  return x === y ? { pick: 'ask' } : { pick: x > y ? 'a' : 'b', by: 'date' };
}
const BLANK_REC = () => ({ f: {}, g: { rubric: [], points: '', comment: '' }, h: {} });
// Settings of the download itself rather than of a student. Each goes on its own, stamped in w.pv = { setting: v } the way a student's record is, so a change to one is never undone by a change to another.
// w.sv is all of them together, and an old copy has only that, or nothing.
const WORK_SET = ['carry', 'setup', 'cls', 'share', 'drive', 'light', 'lightOpt', 'lightPg', 'lightPgL', 'anon', 'moved', 'removed', 'refSkip', 'quiz', 'groups', 'returned'];
const setOf = w => { const o = {}; if (w) for (const k of WORK_SET) if (w[k] !== undefined) o[k] = w[k]; return o; };
const setV = w => w && w.sv ? w.sv : (h => h ? { ['~' + h]: 1 } : {})(hashOf(setOf(w)));
const partV = (w, k) => (w.pv && w.pv[k]) || (h => h ? { ['~' + h]: 1 } : {})(hashOf(w[k]));
const partHashes = w => { const o = {}; for (const k of WORK_SET) { const h = hashOf(w && w[k]); if (h) o[k] = h; } return o; };
// When a setting last changed: a counter is a time, and a setting too old to have one goes by the whole download.
const partT = (w, k) => Math.max(0, ...Object.values((w.pv && w.pv[k]) || {}).filter(n => n > 1)) || w.sat || w.t || 0;
const SET_ASK = 'set:';   // her answer about a setting, among her answers about students
// Everything this copy has seen, for checking against a forgotten download.
function workVec(w) {
  let v = setV(w);
  for (const r of Object.values((w && w.s) || {})) v = vJoin(v, vOf(r));
  return v;
}

/* what a save changed */
const FILE_PARTS = ['f', 'h', 'tr', 'r', 'sk', 'e', 'inc'];
function fileHashes(rec) {
  const by = {}, out = {};
  for (const p of FILE_PARTS) for (const path of Object.keys((rec && rec[p]) || {})) (by[path] ||= {})[p] = rec[p][path];
  for (const path of Object.keys(by)) { const h = hashOf(by[path]); if (h) out[path] = h; }
  return out;
}
// What's kept from the last save, to tell what the next one changed.
function revsOf(work) {
  const o = { s: {}, set: hashOf(setOf(work)), sv: work && work.sv, sat: work && work.sat, pv: work && work.pv, ph: partHashes(work), gone: (work && work.gone) || {} };
  for (const [k, r] of Object.entries((work && work.s) || {})) o.s[k] = { h: recHash(r), fh: fileHashes(r), v: r.v, at: r.at, ft: r.ft };
  return o;
}
// Puts the stamps on a save, changing data in place, and returns what to compare the next one with. seen: a forgotten download's tombstone she has opened it past.
function stampData(prev, data, dev, now, seen) {
  const next = { s: {}, gone: prev.gone };
  for (const key of new Set([...Object.keys(data.s), ...Object.keys(prev.s)])) {
    const p = prev.s[key] || { h: '' };
    if (!data.s[key] && !p.h && !p.v) continue;
    const r = data.s[key] ||= BLANK_REC();   // everything on this student was taken off: that's a change too, so the record stays
    const h = recHash(r), fh = fileHashes(r);
    let { v, at, ft } = p;
    if (h !== p.h) {
      v = vBump(p.v || (p.h ? { ['~' + p.h]: 1 } : {}), dev, now); at = now; ft = { ...p.ft };
      for (const path of new Set([...Object.keys(fh), ...Object.keys(p.fh || {})])) if (fh[path] !== (p.fh || {})[path]) ft[path] = now;
    }
    if (v) r.v = v; if (at) r.at = at; if (ft && Object.keys(ft).length) r.ft = ft;
    next.s[key] = { h, fh, v, at, ft };
  }
  next.set = hashOf(setOf(data)); next.sv = prev.sv; next.sat = prev.sat;
  if (next.set !== prev.set || seen) {
    let v = prev.sv || (prev.set ? { ['~' + prev.set]: 1 } : {});
    if (seen) v = vJoin(v, seen);
    next.sv = vBump(v, dev, now); next.sat = now;
  }
  if (next.sv) data.sv = next.sv; if (next.sat) data.sat = next.sat;
  next.ph = partHashes(data); next.pv = { ...prev.pv };
  for (const k of WORK_SET) if (next.ph[k] !== prev.ph[k]) next.pv[k] = vBump(next.pv[k] || (prev.ph[k] ? { ['~' + prev.ph[k]]: 1 } : {}), dev, now);
  if (Object.keys(next.pv).length) data.pv = next.pv; else delete data.pv;
  next.gone = data.gone = { ...next.gone, ...(data.gone || {}) };
  if (!Object.keys(data.gone).length) delete data.gone;
  return next;
}

/* a rubric and the scores given with it */
// What in a rubric decides a total or a percent: how many rows or points, and the grading scale when its top score is the total possible. A row's name and what each score means don't.
// A setup too old to mention a scale has the usual one. One that says null chose No scale, and its percents are the plain share.
function rubricKey(su) {
  const s = su || {}, pts = s.mode === 'points', max = pts ? +(s.outOf == null ? 10 : s.outOf) || 0 : (s.criteria ? s.criteria.length : 3) * 4, sc = s.scale === undefined ? SCALE12 : s.scale || {};
  const keys = Object.keys(sc).filter(k => sc[k] !== '' && sc[k] != null && !isNaN(+sc[k])).map(Number).sort((a, b) => a - b);
  return JSON.stringify([pts, max, keys.length >= 2 && keys[keys.length - 1] === max ? keys.map(k => [k, +sc[k]]) : 0]);
}
const rubricsDiffer = (x, y) => rubricKey(x) !== rubricKey(y);
// Has this work got a score that another rubric would show differently? Missing and excused have no number.
function workScored(w) {
  const blank = v => v == null || v === '';
  if (w && Object.keys(w.read || {}).length) return true;
  return !!w && Object.values(w.s || {}).some(r => { const g = (r && r.g) || {}; return g.status !== 'missing' && g.status !== 'excused' && ((g.rubric || []).some(v => v != null) || !blank(g.points) || !blank(g.sheet)); });
}
const noSpot = s => { const { spot, ...o } = s || {}; return o; };
// Which of two copies of a rubric is the card's: by what it says, and then by what it would score.
function cardSide(x, y, c) {
  const says = s => hashOf(noSpot(s)) === hashOf(noSpot(c)), fits = s => !rubricsDiffer(s, c);
  return says(x) !== says(y) ? (says(x) ? 'a' : 'b') : fits(x) !== fits(y) ? (fits(x) ? 'a' : 'b') : null;
}

/* scores going from one copy's rows to another's */
// A score belongs to a row by its place, and every copy's scores fit that copy's rows. Two copies can have different rows, so a score only crosses over by what can be told about the rows.
// Rows get added or taken out and never moved, so a name that's once on each list is the same row. Between two of those, as many rows on each side are the same rows renamed, and rows on one side only were added or taken out.
// null: nothing shifts. { map, sure }: map[row here] is that row's place on the other list, or null. sure is false when a row can't be told from one renamed, and then only rows that match by name are kept.
function rowLine(from, to) {
  const nf = from.map(normName), nt = to.map(normName), once = (l, n) => l.includes(n) && l.indexOf(n) === l.lastIndexOf(n);
  const named = nt.flatMap((n, t) => once(nt, n) && once(nf, n) ? [[nf.indexOf(n), t]] : []);
  if (!named.length && to.length >= from.length) return null;   // no name in common and no row gone: renamed rows or a saved rubric, which go by place
  let map = to.map(() => null), f0 = 0, t0 = 0, sure = true;
  for (const [f, t] of [...named, [from.length, to.length]]) {
    if (f < f0) { sure = false; continue; }
    const x = f - f0, y = t - t0;
    if (x === y) for (let k = 0; k < x; k++) map[t0 + k] = f0 + k;
    else if (x && y) sure = false;
    if (t < to.length) map[t] = f;
    f0 = f + 1; t0 = t + 1;
  }
  if (!sure) { map = to.map(() => null); for (const [f, t] of named) map[t] = f; return { map, sure }; }
  return map.every((f, t) => f === t || (f == null && t >= from.length)) ? null : { map, sure };
}
const rowsLine = (x, y) => x && y && x.criteria && y.criteria ? rowLine(x.criteria, y.criteria) : null;
// A student's scores moved to the rows they belong on, each with its own time.
function placeRows(rec, line) {
  const g = rec.g, at = g.atR, out = { ...g, rubric: line.map.map(f => f == null || g.rubric[f] == null ? null : g.rubric[f]) };
  if (at) { out.atR = at.points ? { points: at.points } : {}; line.map.forEach((f, t) => { if (f != null && at[f]) out.atR[t] = at[f]; }); }
  return { ...rec, g: out };
}

/* one download */
// A setting changed on both sides with a safe answer: lists and what's kept per student or per page are pooled, and where they disagree w (the later one) stands.
const SET_POOL = new Set(['share', 'light', 'lightPg', 'lightPgL', 'moved', 'removed', 'refSkip']);
function poolOf(w, l) {
  if (Array.isArray(w) && Array.isArray(l)) return [...new Set([...l, ...w].map(x => JSON.stringify(x)))].map(x => JSON.parse(x));
  if (!w || !l || typeof w !== 'object' || typeof l !== 'object' || Array.isArray(w) || Array.isArray(l)) return w === undefined ? l : w;
  const o = { ...l };
  for (const k of Object.keys(w)) o[k] = poolOf(w[k], l[k]);
  return o;
}
// The Claude code key. A reply can come back with either computer's codes, so a student's other code stays on in share.also = { code: student }.
// The ones that go on being used are from the last ZIP made, or if no ZIP says, the earlier ones (lo).
// A code that points at two students could be anyone's reply, so it stops matching, and the student gets a new one.
function mergeShare(hi, lo) {
  const out = poolOf(hi, lo);
  if (!hi || !lo) return out;
  const by = new Map(), who = (c, k) => { if (!by.has(c)) by.set(c, new Set()); by.get(c).add(k); }, codes = hi.made > (lo.made || 0) ? { ...lo.codes, ...hi.codes } : { ...hi.codes, ...lo.codes }, also = {};
  for (const m of [hi.codes, lo.codes]) for (const [k, c] of Object.entries(m || {})) who(c, k);
  for (const m of [hi.also, lo.also]) for (const [c, k] of Object.entries(m || {})) who(c, k);
  for (const k of Object.keys(codes)) if (by.get(codes[k]).size > 1) delete codes[k];
  for (const [c, ks] of by) { const [k] = ks; if (ks.size === 1 && codes[k] !== c) also[c] = k; }
  out.codes = codes;
  if (Object.keys(also).length) out.also = also; else delete out.also;
  return out;
}
// Which settings changed on both sides are hers to choose: they change grades, whose paper is whose, or who she can see. The rest have a safe answer.
function partAsks(k, x, y, card) {
  if (k === 'setup') return !card && hashOf(noSpot(x)) !== hashOf(noSpot(y));   // with a card, the only question is one about the scores (below)
  if (k === 'cls') return true;
  if (k === 'anon') return !!(x && x.on) !== !!(y && y.on);
  if (k === 'moved') return Object.keys(x || {}).some(p => y && y[p] != null && y[p] !== x[p]);
  return false;
}
// What's been looked at on each scanned page is pooled. An answer she gave stays given (rec.off only ever gains them), so a fix she put back in one place stays put back in both.
// A fix only one side still has stands unless the other side put it back. her: how many pages have an answer from y that x hasn't.
function mergeScan(x, y) {
  if (!x || !y) { const only = x || y; return { scan: only, her: y ? Object.values(y).reduce((n, q) => n + Object.values(q.rec || {}).filter(r => r.off && Object.keys(r.off).length).length, 0) : 0 }; }
  const scan = {}; let her = 0;
  for (const path of new Set([...Object.keys(x), ...Object.keys(y)])) {
    const p = x[path], q = y[path];
    if (!p || !q) { const m = mergeScan(p && { [path]: p }, q && { [path]: q }); scan[path] = m.scan[path]; her += m.her; continue; }
    const rec = {}, at = {};
    for (const n of new Set([...Object.keys(p.rec || {}), ...Object.keys(q.rec || {})])) {
      const r = (p.rec || {})[n], s = (q.rec || {})[n], off = { ...(s && s.off), ...(r && r.off) };
      rec[n] = { ...s, ...r };
      if (Object.keys(off).length) rec[n].off = off;
      if (Object.keys(off).some(k => !(r && r.off && r.off[k]))) her++;
      const A = (p.at || {})[n] || {}, B = (q.at || {})[n] || {}, o = {};
      for (const [c, why] of [['r', 'turn'], ['k', 'skew']]) {
        const v = A[c] != null ? A[c] : B[c];
        if (v != null && !(A[c] == null && r && r.off && r.off[why]) && !(B[c] == null && s && s.off && s.off[why])) o[c] = v;
      }
      if (Object.keys(o).length) at[n] = o;
    }
    scan[path] = { rec, at };
  }
  return { scan, her };
}
// a and b are two copies of a download's work. o.answers: { student: 'a' | 'b' }, her choices. o.prefer: this side wins everything, for going back to an earlier state.
// o.linked: the download opens from an assignment card. 'ask' or 'a' or 'b' is where a question about the card's rubric stands, and this copy of the rubric goes with it. { setup } is the card's rubric, with no question about it:
// if the two copies would score differently, she's asked unless the newer copy is plainly the card's. Whatever she says goes for the card too (rubricSaid, libFollow).
function mergeWork(a, b, o = {}) {
  if (!a || !b) return { work: a || b, rows: [], ask: [], toA: !a, toB: !b, setIn: [], setBoth: [] };
  const { answers = {}, prefer, dev = 'merge', now = Date.now() } = o, rows = [], ask = [], s = {}, sameV = (x, y) => JSON.stringify(canon(x)) === JSON.stringify(canon(y));
  let toA = false, toB = false, rubricSaid = false;
  const ta = a.t || 0, tb = b.t || 0, as = a.s || {}, bs = b.s || {};
  for (const key of new Set([...Object.keys(as), ...Object.keys(bs)])) {
    const ra = as[key], rb = bs[key];
    let d = decideRec(ra, rb, ta, tb), chosen = false;
    if (prefer && d.pick !== 'same') { d = { pick: prefer, by: 'prefer' }; chosen = true; }
    if (d.pick === 'ask' && answers[key]) { d = { pick: answers[key], by: 'her' }; chosen = true; }
    const row = { key, pick: d.pick, by: d.by, ta: recTime(ra, ta), tb: recTime(rb, tb) };
    rows.push(row);
    if (d.pick === 'ask') { s[key] = ra; ask.push({ key, a: ra, b: rb, ta: row.ta, tb: row.tb }); continue; }
    if (d.pick === 'same') {
      const rec = ra || rb, v = vJoin(vOf(ra), vOf(rb));
      s[key] = Object.keys(v).length && (ra && ra.v || rb && rb.v) ? { ...rec, v } : rec;
      if (s[key].v && JSON.stringify(canon(s[key].v)) !== JSON.stringify(canon(ra && ra.v))) toA = true;
      if (s[key].v && JSON.stringify(canon(s[key].v)) !== JSON.stringify(canon(rb && rb.v))) toB = true;
      continue;
    }
    const win = (d.pick === 'a' ? ra : rb) || BLANK_REC();
    // Her choice comes after both copies, so neither ever overrides it. The order alone gives the winner's own stamps, already ahead of the other's.
    s[key] = chosen ? { ...win, v: vBump(vJoin(vOf(ra), vOf(rb)), dev, now), at: recTime(win) || now } : win;
    if (d.pick === 'b' || chosen) toA = true;
    if (d.pick === 'a' || chosen) toB = true;
  }
  // Settings, one at a time: the same order, and if both changed, her choice or a safe answer.
  const ha = hashOf(setOf(a)), hb = hashOf(setOf(b)), va0 = setV(a), vb0 = setV(b), parts = {}, pv = {}, setIn = [], setBoth = [];
  let sv = vJoin(va0, vb0), merged = false;
  for (const k of WORK_SET) {
    const x = a[k], y = b[k], hx = hashOf(x), hy = hashOf(y), px = a.pv && a.pv[k], py = b.pv && b.pv[k], join = () => vJoin(partV(a, k), partV(b, k));
    let val = x, v = px || py ? join() : undefined;
    if (hx !== hy) {
      // Saved before settings had their own history: the whole download's order is all there is.
      const none = !px && !py && (a.sv || b.sv), vx = none ? va0 : partV(a, k), vy = none ? vb0 : partV(b, k), ge = vGeq(vx, vy), le = vGeq(vy, vx), said = answers[SET_ASK + k];
      const both = w => { const [hi, lo] = w === 'a' ? [x, y] : [y, x]; val = k === 'share' ? mergeShare(hi, lo) : SET_POOL.has(k) ? poolOf(hi, lo) : hi; v = vBump(join(), dev, now); merged = true; };
      const card = k === 'setup' && o.linked && o.linked.setup, newer = ge && !le ? x : le && !ge ? y : null;
      const choose = () => { if (said) { both(said); if (k === 'setup') rubricSaid = true; } else { v = px; ask.push({ key: SET_ASK + k, part: k, a: x, b: y, vb: py, ta: partT(a, k), tb: partT(b, k), notBoth: !!newer }); } };
      if (prefer) { val = prefer === 'a' ? x : y; v = vBump(join(), dev, now); merged = true; }
      else if (k === 'setup' && o.linked === 'ask') v = px;   // the question is about the card this download opens from
      else if (k === 'setup' && (o.linked === 'a' || o.linked === 'b')) both(o.linked);   // and this copy of the rubric goes with her answer
      else if (card && rubricsDiffer(x, y) && (workScored(a) || workScored(b)) && (!newer || rubricsDiffer(newer, card))) choose();
      else if (ge && !le) v = px;
      else if (le && !ge) { val = y; v = py; }
      else if (((px && py) || (k === 'setup' && rubricsDiffer(x, y) && (workScored(a) || workScored(b)))) && partAsks(k, x, y, card)) choose();   // copies too old to have stamps get no guess about a grade either
      else {
        const side = card && cardSide(x, y, card);   // no scores hang on it, so the card's rubric stands
        both(side || (partT(b, k) > partT(a, k) ? 'b' : 'a'));
        if (!side) setBoth.push({ k, pooled: SET_POOL.has(k) });
      }
      if (hashOf(val) !== hx) { setIn.push(k); toA = true; }
      if (hashOf(val) !== hy) toB = true;
    }
    if (val !== undefined) parts[k] = val;
    if (v) pv[k] = v;
  }
  if (merged) sv = vBump(sv, dev, now);
  const keepSv = !!(a.sv || b.sv || prefer || ha !== hb);
  if (keepSv && !sameV(sv, a.sv)) toA = true;
  if (keepSv && !sameV(sv, b.sv)) toB = true;
  if (!sameV(pv, a.pv)) toA = true;
  if (!sameV(pv, b.pv)) toB = true;
  // A student who stays or comes in under other rows than the ones kept goes by row, and doesn't shift. If the rows can't be told apart, she's asked, and sees each copy's rows.
  const lined = [], su = parts.setup, lineTo = w => su && su.mode !== 'points' ? rowsLine(w.setup, su) : null, scored = r => !!r && !!r.g && (r.g.rubric || []).some(v => v != null);
  for (const row of prefer ? [] : rows) {
    if (row.pick === 'same') continue;
    const key = row.key, ra = as[key], rb = bs[key], said = answers[key];
    let line = lineTo(row.pick === 'b' ? b : a);
    if (line && !line.sure && row.pick !== 'ask' && row.by !== 'her' && scored(s[key])) {
      if (said) { const win = (said === 'a' ? ra : rb) || BLANK_REC(); s[key] = { ...win, v: vBump(vJoin(vOf(ra), vOf(rb)), dev, now), at: recTime(win) || now }; row.pick = said; row.by = 'her'; toA = toB = true; }
      else { row.pick = 'ask'; if (ra) s[key] = ra; else delete s[key]; ask.push({ key, a: ra, b: rb, ta: row.ta, tb: row.tb }); }
      line = lineTo(row.pick === 'b' ? b : a);
    }
    if (!line || !scored(s[key])) continue;
    s[key] = placeRows(s[key], line);
    if (row.pick === 'ask') continue;   // until she's answered, this copy keeps its own stamps
    s[key].v = vBump(vJoin(vOf(ra), vOf(rb)), dev, now);
    lined.push(key); toA = toB = true;
  }
  if (rowsLine(a.setup, b.setup) || rowsLine(b.setup, a.setup)) {
    const off = [a, b].some(w => { const l = lineTo(w); return l && !l.sure; });
    for (const q of ask) if (!q.part) Object.assign(q, { ca: a.setup.criteria, cb: b.setup.criteria, off });
  }
  const out = { ...a, s };
  for (const k of WORK_SET) delete out[k];
  Object.assign(out, parts);
  if (keepSv) out.sv = sv;
  if (Object.keys(pv).length) out.pv = pv; else delete out.pv;
  // Beside the settings: what's been looked at on each page, and scores read off the paper for Past work. Neither is ever a reason to ask.
  if (prefer) { const w = prefer === 'a' ? a : b; if (w.scan) out.scan = w.scan; else delete out.scan; }
  else if (a.scan || b.scan) {
    const sc = mergeScan(a.scan, b.scan);
    out.scan = sc.scan;
    if (sc.her) setIn.push('scan');
    if (!sameV(out.scan, a.scan)) toA = true;
    if (!sameV(out.scan, b.scan)) toB = true;
  }
  if (!prefer && (a.read || b.read)) {
    out.read = { ...b.read, ...a.read };
    for (const r of rows) if (r.pick === 'b' && b.read && b.read[r.key]) out.read[r.key] = b.read[r.key];
    if (!sameV(out.read, a.read)) toA = true;
    if (!sameV(out.read, b.read)) toB = true;
  }
  const sat = Math.max(a.sat || 0, b.sat || 0); if (sat) out.sat = sat;
  const gone = { ...(a.gone || {}) };
  if (prefer !== 'a') { for (const [k, t] of Object.entries(b.gone || {})) if (!(gone[k] >= t)) gone[k] = t; }
  else if (!sameV(gone, b.gone)) toB = true;   // going back: a file taken off since comes back with everything else, so it can't stay marked as off
  if (Object.keys(gone).length) out.gone = gone;
  out.t = Math.max(ta, tb) + (toA ? 1 : 0);
  return { work: out, rows, ask, toA, toB, setIn, setBoth, rubricSaid, lined };
}
// Late files and readings. Each side lists { 'student|path': time added }; a file taken off on one side stays off unless it was added again after that.
// prefer 'a': going back, so what this side has is what there is.
function mergeFiles(aHas = {}, bHas = {}, aGone = {}, bGone = {}, prefer) {
  const out = { fromB: [], fromA: [], dropA: [], dropB: [] }, off = (t, gone) => gone != null && gone >= (t || 0);
  if (prefer === 'a') {
    out.dropB = Object.keys(bHas).filter(k => !(k in aHas)); out.fromA = Object.keys(aHas).filter(k => !(k in bHas));
    return out;
  }
  for (const k of Object.keys(bHas)) if (!(k in aHas)) { if (off(bHas[k], aGone[k])) out.dropB.push(k); else out.fromB.push(k); }
  for (const k of Object.keys(aHas)) {
    if (k in bHas) {
      if (off(aHas[k], bGone[k])) out.dropA.push(k); else if (off(bHas[k], aGone[k])) out.dropB.push(k);
      else if (aHas[k] && bHas[k] && aHas[k] !== bHas[k]) out[bHas[k] > aHas[k] ? 'fromB' : 'fromA'].push(k);   // replaced under the same name: the later one goes both ways
      continue;
    }
    if (off(aHas[k], bGone[k])) out.dropA.push(k); else out.fromA.push(k);
  }
  return out;
}
// Word edits follow the student they belong to: whichever copy of the student won brings its edits. edits: { path: time }.
// A stamped copy that won without an edit has had it taken off. An old record doesn't say, so the edit stays. Nor does a copy she picked over the other, which may never have seen the edit, unless it says she took this one off.
const editKey = path => { const parts = path.split('/').filter(Boolean); return parts.length > 1 ? parts[0] : parts[0].replace(/\.[^.]+$/, ''); };   // a loose file is a student of its own, by its name
const EDIT_OFF = '~edit|';   // in work.gone: when a Word edit was taken off
function mergeEdits(aEd = {}, bEd = {}, work, rows, prefer) {
  const out = { fromB: [], fromA: [], dropA: [], dropB: [] }, pickOf = {}, her = {};
  for (const r of rows || []) { pickOf[r.key] = r.pick; her[r.key] = r.by === 'her'; }
  for (const path of new Set([...Object.keys(aEd), ...Object.keys(bEd)])) {
    const x = aEd[path], y = bEd[path], key = (work && work.moved && work.moved[path]) || editKey(path), pick = pickOf[key];
    if (x === y) continue;
    if (prefer === 'a') { out[x != null ? 'fromA' : 'dropB'].push(path); continue; }
    if (pick === 'ask') continue;
    const side = pick === 'a' || pick === 'b' ? pick : (y || 0) > (x || 0) ? 'b' : 'a', other = side === 'a' ? 'B' : 'A', own = side === 'a' ? 'A' : 'B';
    if ((side === 'a' ? x : y) != null) out['from' + own].push(path);
    else if ((!her[key] && work && work.s && work.s[key] && work.s[key].v) || (work && work.gone && work.gone[EDIT_OFF + path] >= (side === 'a' ? y : x))) out['drop' + other].push(path);
    else out['from' + other].push(path);
  }
  return out;
}
// How a saved download's scores stand, counted the way the Grades list counts them. Missing and excused have no number, and a partial isn't finished.
function workCounts(work) {
  const su = work.setup || {}, s = work.s || {}, read = work.read || {}, blank = v => v == null || v === '';
  const out = { scored: 0, partial: 0, off: 0 };
  for (const k of new Set([...Object.keys(s), ...Object.keys(read)])) {
    const g = (s[k] && s[k].g) || {}, r = g.rubric || [], rows = su.criteria ? su.criteria.map((_, i) => r[i]) : r, on = rows.filter(v => v != null).length;
    if (g.status === 'missing' || g.status === 'excused') out.off++;
    else if (su.mode === 'points' ? !blank(g.points) && !isNaN(+g.points) : on === rows.length && on) out.scored++;
    else if (su.mode !== 'points' && on) out.partial++;
    else if ((!blank(g.sheet) && !isNaN(+g.sheet)) || read[k]) out.scored++;
  }
  if (work.returned) out.ret = work.returned.t;   // the marked files went back to the students
  return out;
}
// The row for the list of downloads.
function metaFor(ma, mb, work, id) {
  const m = { ...(mb || {}), ...(ma || {}), id };
  if (!m.name) m.name = 'A download';   // work from before the list of downloads was kept says nothing about its name
  if (work) {
    m.t = work.t || m.t;
    Object.assign(m, workCounts(work));
    if (!work.returned) delete m.ret;
    m.n = Math.max(m.n || 0, Object.keys(work.s || {}).length);
  }
  return m;
}
// Everything: a state is { work: {id}, meta: {id}, tomb: {id: {t, v, name}}, added: {id: {'student|path': time}}, edits: {id: {path: time}} }.
// o.answers: { id: { student: 'a' | 'b' } }, and { '!id': 'back' | 'gone' } for a forgotten download with newer work on the other side.
function mergeStates(A, B, o = {}) {
  const ids = new Set(), rows = [], tomb = {}, ans = o.answers || {};
  for (const S of [A, B]) for (const part of [S.work, S.meta, S.tomb]) for (const id of Object.keys(part || {})) ids.add(id);
  for (const id of ids) {
    const wa = (A.work || {})[id], wb = (B.work || {})[id], ma = (A.meta || {})[id], mb = (B.meta || {})[id], ga = (A.tomb || {})[id], gb = (B.tomb || {})[id];
    const name = (ma && ma.name) || (mb && mb.name) || (ga && ga.name) || (gb && gb.name) || 'A download', onA = !!(wa || ma), onB = !!(wb || mb);
    const t = ga && gb ? { ...ga, t: Math.max(ga.t, gb.t), v: vJoin(ga.v, gb.v) } : ga || gb;
    let seen = null;
    if (t) {
      if (!onA && !onB) { tomb[id] = t; continue; }
      const vec = vJoin(workVec(wa), workVec(wb)), answer = ans['!' + id];
      if (!vGeq(vec, t.v)) {   // a copy opened again on purpose has seen the tombstone, so it comes after it; anything else hasn't
        if (vGeq(t.v, vec) || answer === 'gone') { tomb[id] = t; rows.push({ id, name, kind: 'gone', onA, onB, t: t.t }); continue; }
        if (answer !== 'back') { tomb[id] = t; rows.push({ id, name, kind: 'askGone', onA, onB, t: t.t, work: wa || wb }); continue; }
        seen = t.v;
      }
    }
    // Going back past when a download had any work: its row stays with no marks, and the work in the other copy mustn't come back.
    const lk = !!o.linked && o.linked.get(id), m = mergeWork(o.prefer === 'a' && !wa && ma ? { t: 0, s: {} } : wa, wb, { answers: ans[id], prefer: o.prefer, dev: o.dev, now: o.now, linked: lk });
    if (seen && m.work) { m.work = { ...m.work, sv: vBump(vJoin(setV(m.work), seen), o.dev || 'merge', o.now || Date.now()) }; m.toA = m.toB = true; }
    const files = mergeFiles((A.added || {})[id], (B.added || {})[id], (wa && wa.gone) || {}, (wb && wb.gone) || {}, o.prefer);
    const edits = mergeEdits((A.edits || {})[id], (B.edits || {})[id], m.work, m.rows, o.prefer);
    const real = m.rows.filter(r => r.pick === 'a' || r.pick === 'b');
    const extra = files.fromB.length + files.dropA.length + edits.fromB.length + edits.dropA.length;   // what she'd see change here besides students
    const kind = !onA ? 'new' : !onB ? 'onlyA' : m.ask.length || real.length || extra || m.setIn.length || m.setBoth.length ? 'merge' : 'same';
    // Still different from its card, with nothing here to settle it: the question comes when she opens it.
    const cardOff = !m.ask.length && !m.rubricSaid && !!(lk && lk.setup && m.work && m.work.setup) && rubricsDiffer(lk.setup, m.work.setup) && workScored(m.work);
    rows.push({ id, name, kind, work: m.work, rows: m.rows, lined: m.lined, ask: m.ask, toA: m.toA, toB: m.toB, setIn: m.setIn, setBoth: m.setBoth, follow: m.rubricSaid ? m.work.setup : undefined, cardOff, files, edits, extra, meta: metaFor(ma, mb, m.work, id), ma, mb, anon: !!((wa && wa.anon && wa.anon.on) || (wb && wb.anon && wb.anon.on)) });
  }
  return { rows, tomb, asks: rows.flatMap(r => r.kind === 'askGone' ? [{ gone: true, id: r.id, name: r.name, t: r.t, work: r.work }] : (r.ask || []).map(x => ({ ...x, id: r.id, name: r.name, anon: r.anon }))) };
}

/* two tabs on one computer */
// Did the copy in storage change anything from what this tab last saved or opened with?
function tabDiffers(was, other) {
  const oh = partHashes(other);
  if (WORK_SET.some(k => oh[k] !== was.ph[k])) return true;
  for (const key of new Set([...Object.keys(other.s || {}), ...Object.keys(was.s)])) if (recHash((other.s || {})[key]) !== ((was.s[key] || {}).h || '')) return true;
  return false;
}
// Another tab has saved this download since this one opened it, so this tab's copy of anyone it hasn't changed is out of date, and only what changed here goes in.
// data: this tab's save, stamped. was: what it's compared with, from before this save. changed: this save has something of its own.
function tabMerge(data, was, other) {
  const s = {}, os = other.s || {};
  let changed = false;
  for (const key of new Set([...Object.keys(data.s), ...Object.keys(os)])) {
    const r = data.s[key], o = os[key];
    if (!r || recHash(r) === ((was.s[key] || {}).h || '')) { s[key] = o || r; continue; }
    changed = true;
    s[key] = o ? { ...r, v: vJoin(vOf(o), r.v || {}) } : r;
  }
  const out = { ...data, s, t: Math.max(data.t, (other.t || 0) + 1) }, mine = partHashes(data), pv = { ...data.pv };
  let ownSet = false;
  for (const k of WORK_SET) {   // settings go one at a time too: what this tab changed, and the other's word and stamps on the rest
    const ov = other.pv && other.pv[k];
    if (mine[k] !== was.ph[k]) { ownSet = true; if (ov) pv[k] = vJoin(ov, pv[k] || {}); continue; }
    if (other[k] !== undefined) out[k] = other[k]; else delete out[k];
    if (ov) pv[k] = ov; else delete pv[k];
  }
  if (Object.keys(pv).length) out.pv = pv; else delete out.pv;
  if (ownSet) { changed = true; if (data.sv || other.sv) out.sv = vJoin(other.sv || {}, data.sv || {}); }
  else {
    if (other.sv) out.sv = other.sv; else delete out.sv;
    if (other.sat) out.sat = other.sat; else delete out.sat;
  }
  const gone = { ...(other.gone || {}), ...(data.gone || {}) };
  if (Object.keys(gone).length) out.gone = gone;
  for (const k of ['read', 'scan']) if (data[k] || other[k]) out[k] = { ...(data[k] || {}), ...(other[k] || {}) };   // readings kept from the papers, which the newer copy knows best
  return { data: out, changed };
}

/* classes, units, assignments and rosters */
// Each is stamped like a student's record, in its own v and at. A class, unit or assignment that's deleted leaves its id in lib.gone. It stays gone unless it changed where the delete couldn't see.
// Opening an assignment card only says when it was last opened, which isn't a change to the card. Each field has its own stamps in fv, so a change to one isn't undone by a change to another.
const LIB_SKIP = new Set(['id', 'units', 'items', 'v', 'at', 'gone', 'fv', 'opened']);
function libWalk(l) {
  const out = new Map();
  const add = (type, n, parent) => { const fields = {}; for (const k of Object.keys(n)) if (!LIB_SKIP.has(k)) fields[k] = n[k]; out.set(n.id, { id: n.id, type, node: n, fields, parent }); };
  const unit = (u, parent) => { add('u', u, parent); for (const it of u.items || []) add('i', it, u.id); };
  for (const c of (l && l.classes) || []) { add('c', c, null); for (const u of c.units || []) unit(u, c.id); }
  for (const u of (l && l.loose && l.loose.units) || []) unit(u, '');
  return out;
}
const nodeParts = e => ({ p: e.parent, ...e.fields });
const nodeHash = e => hashOf(nodeParts(e));
const nodeV = e => e.node.v || (h => h ? { ['~' + h]: 1 } : {})(nodeHash(e));
const fieldHashes = e => { const o = {}; for (const [k, x] of Object.entries(nodeParts(e))) { const h = hashOf(x); if (h) o[k] = h; } return o; };
const fieldV = (e, k) => (e.node.fv && e.node.fv[k]) || (h => h ? { ['~' + h]: 1 } : {})(hashOf(nodeParts(e)[k]));
const fieldT = (e, k) => Math.max(0, ...Object.values((e.node.fv && e.node.fv[k]) || {}).filter(n => n > 1)) || e.node.at || 0;
function libPrev(l) { const m = new Map(); for (const e of libWalk(l).values()) m.set(e.id, { h: nodeHash(e), v: e.node.v, fh: fieldHashes(e), fv: e.node.fv }); return m; }
function stampLib(l, prev, dev, now) {
  const walk = libWalk(l), next = new Map();
  for (const e of walk.values()) {
    const h = nodeHash(e), p = prev.get(e.id), fh = fieldHashes(e);
    if (!p || p.h !== h) {
      e.node.v = vBump((p && p.v) || (p ? { ['~' + p.h]: 1 } : {}), dev, now); e.node.at = now;
      if (p) {
        const fv = { ...p.fv };
        for (const k of new Set([...Object.keys(fh), ...Object.keys(p.fh)])) if (fh[k] !== p.fh[k]) fv[k] = vBump(fv[k] || (p.fh[k] ? { ['~' + p.fh[k]]: 1 } : {}), dev, now);
        e.node.fv = fv;
      }
    }
    next.set(e.id, { h, v: e.node.v, fh, fv: e.node.fv });
  }
  for (const [id, p] of prev) if (!walk.has(id)) (l.gone ||= {})[id] = { t: now, v: p.v || { ['~' + p.h]: 1 } };
  return next;
}
const normName = s => String(s || '').replace(/\s+/g, '').toLowerCase();
const blankClass = c => !c.v && !(c.names || []).length && !(c.units || []).some(u => u && (u.items || []).length);
function renameClass(l, from, to) {
  for (const c of l.classes || []) if (c.id === from) { c.id = to; for (const u of c.units || []) for (const it of u.items || []) if (it.classId === from) it.classId = to; }
}
// Going back on purpose: this copy is the one, stamped to come after all the other has seen, and what only the other has stays gone.
function libGoBack(a0, b0, dev, now) {
  const a = JSON.parse(JSON.stringify(a0 || { classes: [] })), wa = libWalk(a), wb = libWalk(b0), goneB = (b0 && b0.gone) || {}, gone = { ...(a.gone || {}) };
  for (const e of wa.values()) {
    const y = wb.get(e.id), g = goneB[e.id], seen = vJoin(y ? nodeV(y) : {}, g ? g.v : {});
    if (g || (y && nodeHash(y) !== nodeHash(e))) { e.node.v = vBump(vJoin(nodeV(e), seen), dev, now); e.node.at = now; }
    else if (y && (e.node.v || y.node.v)) e.node.v = vJoin(nodeV(e), seen);
    delete gone[e.id];
  }
  for (const y of wb.values()) if (!wa.has(y.id)) gone[y.id] = { t: now, v: vJoin((gone[y.id] || {}).v || {}, nodeV(y)) };
  if (Object.keys(gone).length) a.gone = gone; else delete a.gone;
  const same = (p, q) => JSON.stringify(canon(p)) === JSON.stringify(canon(q));
  return { lib: a, notes: [], asks: [], cards: {}, mapA: {}, mapB: {}, toA: !same(a, a0), toB: !same(a, b0) };
}
// A brand-new browser's starter classes have the same names as the real ones with ids of their own, so classes with no id in common are matched by name.
function mergeLib(a0, b0, o = {}) {
  const { dev = 'merge', now = Date.now() } = o;
  if (o.prefer === 'a') return libGoBack(a0, b0, dev, now);
  const a = JSON.parse(JSON.stringify(a0 || { classes: [] })), b = JSON.parse(JSON.stringify(b0 || { classes: [] })), notes = [], asks = [], cards = {}, mapA = {}, mapB = {};
  for (const cb of [...(b.classes || [])]) {
    if ((a.classes || []).some(c => c.id === cb.id)) continue;
    const ca = (a.classes || []).find(c => normName(c.name) === normName(cb.name) && !(b.classes || []).some(x => x.id === c.id));
    if (!ca) continue;
    if (blankClass(ca) && !blankClass(cb)) { mapA[ca.id] = cb.id; renameClass(a, ca.id, cb.id); }
    else { mapB[cb.id] = ca.id; renameClass(b, cb.id, ca.id); }
  }
  const wa = libWalk(a), wb = libWalk(b), goneA = a.gone || {}, goneB = b.gone || {}, kept = new Map();
  for (const id of new Set([...wa.keys(), ...wb.keys()])) {
    const x = wa.get(id), y = wb.get(id);
    if (!x || !y) {
      const e = x || y, g = (x ? goneB : goneA)[id];
      if (g && vGeq(g.v, nodeV(e))) { if (x) notes.push({ kind: 'gone', type: e.type, name: e.fields.name }); continue; }
      kept.set(id, e);
      if (!x) notes.push(e.type === 'c' ? { kind: 'newClass', name: e.fields.name, n: (e.fields.names || []).length } : { kind: e.type === 'u' ? 'newUnit' : 'newItem', name: e.fields.name });
      continue;
    }
    if (nodeHash(x) === nodeHash(y)) { kept.set(id, vJoinNode(x, y)); continue; }
    if (x.type === 'c' && blankClass(x.node)) { kept.set(id, y); rosterNote(notes, x, y); continue; }
    if (y.type === 'c' && blankClass(y.node)) { kept.set(id, x); continue; }
    const vx = nodeV(x), vy = nodeV(y), ge = vGeq(vx, vy), le = vGeq(vy, vx);
    if (ge && !le) { kept.set(id, x); continue; }
    if (le && !ge) { kept.set(id, y); if (x.type === 'c') rosterNote(notes, x, y); else notes.push({ kind: 'changed', type: x.type, name: y.fields.name }); continue; }
    // Both changed, or there's no history to tell by. Field by field: the one that changed it, and if both did, the later time. A roster takes everyone from both, so no name is ever lost by merging.
    const said = o.answers && o.answers[id] && o.answers[id][SET_ASK + 'setup'], win = (y.node.at || 0) > (x.node.at || 0) ? y : x, m = mergeFields(x, y, win, dev, now, said);
    // Until she's answered, this copy keeps its own stamps: it hasn't taken in the other's rubric, so the question stays open.
    const e = { ...win, parent: m.parts.p, fields: {}, node: { ...win.node, v: m.ask ? x.node.v : vBump(vJoin(vx, vy), dev, now), at: m.ask ? x.node.at : now, fv: m.fv } };
    for (const k of Object.keys(win.fields)) delete e.node[k];
    for (const [k, val] of Object.entries(m.parts)) if (k !== 'p' && val !== undefined) e.fields[k] = e.node[k] = val;
    if (m.ask) { asks.push({ key: SET_ASK + 'setup', part: 'setup', id, name: e.fields.name, batchId: e.fields.batchId, a: x.fields.setup, b: y.fields.setup, ta: fieldT(x, 'setup'), tb: fieldT(y, 'setup'), there: y.node }); cards[id] = 'ask'; }
    else if (m.chose) cards[id] = said;
    if (x.type === 'c' && m.both.includes('names')) {
      const seen = new Set((x.fields.names || []).map(n => n.normalize('NFC'))), add = (y.fields.names || []).filter(n => !seen.has(n.normalize('NFC')));
      e.fields.names = e.node.names = [...(x.fields.names || []), ...add];
      if (add.length) notes.push({ kind: 'roster', name: x.fields.name, add, drop: [], both: true });
    } else if (x.type === 'c' && m.fromY.includes('names')) rosterNote(notes, x, y);
    if (x.type === 'c' && m.both.includes('info')) {   // student details: per student, and a saved spelling is never lost
      const xi = x.fields.info || {}, yi = y.fields.info || {}, [lo, hi] = win === y ? [xi, yi] : [yi, xi], out = {};
      for (const k of new Set([...Object.keys(xi), ...Object.keys(yi)])) { const o2 = [...new Set([...((lo[k] || {}).other || []), ...((hi[k] || {}).other || [])])]; out[k] = { ...lo[k], ...hi[k], ...(o2.length ? { other: o2 } : {}) }; }
      e.fields.info = e.node.info = out;
    }
    if (x.type === 'c' && m.both.includes('att')) {   // attendance: day by day, and for a day both changed, the one saved later
      const xa = x.fields.att || {}, ya = y.fields.att || {}, out = {};
      for (const k of new Set([...Object.keys(xa), ...Object.keys(ya)])) out[k] = !xa[k] ? ya[k] : !ya[k] ? xa[k] : (ya[k].t || 0) > (xa[k].t || 0) ? ya[k] : xa[k];
      e.fields.att = e.node.att = out;
    }
    const other = m.both.filter(k => k !== 'names' && k !== 'info' && k !== 'att');
    if (other.length) notes.push({ kind: 'both', type: x.type, name: e.fields.name, rubric: other.includes('setup') });
    else if (m.fromY.some(k => k !== 'names')) notes.push({ kind: 'changed', type: x.type, name: e.fields.name });
    kept.set(id, e);
  }
  for (const [id, e] of kept) {   // when it was last opened, anywhere
    const t = Math.max((wa.get(id) || { node: {} }).node.opened || 0, (wb.get(id) || { node: {} }).node.opened || 0);
    if (t && e.node.opened !== t) kept.set(id, { ...e, node: { ...e.node, opened: t } });
  }
  const lib = { ...b, ...a, classes: [], loose: { id: '', units: [] }, units: [] };
  // How a teacher works (lib.me) goes with their work. A browser that was only just set up, with nothing in it yet, takes on the
  // work coming in as it is: if that work is from before the welcome and has no lib.me, this copy drops its own, so every word and
  // default stays what it was where the work was done.
  const hasWork = l => ((l && l.classes) || []).some(c => (c.names || []).length || (c.units || []).some(u => u && (u.items || []).length));
  if (a.me && !b.me && hasWork(b) && !hasWork(a)) delete lib.me;
  const by = t => [...kept.values()].filter(e => e.type === t);
  const shell = e => { const n = { ...e.node }; delete n.units; delete n.items; return n; };
  const units = new Map(), classes = new Map();
  for (const e of by('c')) { const c = { ...shell(e), units: [] }; classes.set(e.id, c); lib.classes.push(c); }
  for (const e of by('u')) {
    const u = { ...shell(e), items: [] }; units.set(e.id, u);
    (classes.get(e.parent) || lib.loose).units.push(u);
  }
  for (const e of by('i')) {
    let u = units.get(e.parent);
    if (!u) {   // its unit is gone, and the assignment isn't: it goes back in a unit of its own, in its class
      const home = classes.get(e.fields.classId) || lib.loose;
      u = home.units.find(x => x.id === 'gs-brought');
      if (!u) { u = { id: 'gs-brought', name: 'Brought in', items: [] }; units.set(u.id, u); home.units.push(u); }
    }
    u.items.push(shell(e));
  }
  const gone = { ...goneA };
  for (const [id, g] of Object.entries(goneB)) gone[id] = gone[id] ? { t: Math.max(gone[id].t, g.t), v: vJoin(gone[id].v, g.v) } : g;
  for (const id of kept.keys()) delete gone[id];
  if (Object.keys(gone).length) lib.gone = gone; else delete lib.gone;
  const same = (p, q) => JSON.stringify(canon(p)) === JSON.stringify(canon(q));
  return { lib, notes, asks, cards, mapA, mapB, toA: !same(lib, a0), toB: !same(lib, b0) };
}
function mergeFields(x, y, win, dev, now, said) {
  const fx = nodeParts(x), fy = nodeParts(y), parts = {}, fv = {}, both = [], fromY = [];
  let ask = false, chose = false;
  for (const k of new Set([...Object.keys(fx), ...Object.keys(fy)])) {
    const hx = hashOf(fx[k]), hy = hashOf(fy[k]), real = (x.node.fv && x.node.fv[k]) || (y.node.fv && y.node.fv[k]), vx = fieldV(x, k), vy = fieldV(y, k);
    if (hx === hy) { parts[k] = fx[k]; if (real) fv[k] = vJoin(vx, vy); continue; }
    const ge = vGeq(vx, vy), le = vGeq(vy, vx);
    if (ge && !le) { parts[k] = fx[k]; if (real) fv[k] = vx; }
    else if (le && !ge) { parts[k] = fy[k]; if (real) fv[k] = vy; fromY.push(k); }
    else if (k === 'setup' && x.type === 'i' && partAsks(k, fx[k], fy[k])) {   // a card's rubric decides its grades, so it's hers to choose, as it is for a download with no card
      if (said) { parts[k] = (said === 'b' ? fy : fx)[k]; fv[k] = vBump(vJoin(vx, vy), dev, now); chose = true; if (said === 'b') fromY.push(k); }
      else { parts[k] = fx[k]; fv[k] = vx; ask = true; }
    }
    else { parts[k] = (win === y ? fy : fx)[k]; fv[k] = vBump(vJoin(vx, vy), dev, now); both.push(k); if (win === y) fromY.push(k); }
  }
  return { parts, fv, both, fromY, ask, chose };
}
function vJoinNode(x, y) {
  if (!x.node.v && !y.node.v) return x;
  return { ...x, node: { ...x.node, v: vJoin(nodeV(x), nodeV(y)) } };
}
function rosterNote(notes, x, y) {
  const was = x.fields.names || [], now = y.fields.names || [], add = now.filter(n => !was.includes(n)), drop = was.filter(n => !now.includes(n));
  if (add.length || drop.length) notes.push({ kind: 'roster', name: y.fields.name, add, drop });
}
// The downloads an assignment card opens, and for each, where the question about its card's rubric stands: 'ask', her answer, or if there isn't one, the card's rubric: { setup }.
const libLinked = (l, cards = {}) => { const o = new Map(); for (const e of libWalk(l).values()) if (e.type === 'i' && e.fields.batchId) o.set(e.fields.batchId, cards[e.id] || { setup: e.fields.setup }); return o; };
// Her answer about a download's rubric goes for its card too, so the two don't disagree again. m: what mergeLib said. rows: what mergeStates said.
function libFollow(m, rows, dev, now) {
  const said = new Map(rows.filter(r => r.follow).map(r => [r.id, r.follow]));
  if (!said.size) return;
  for (const e of libWalk(m.lib).values()) {
    const su = e.type === 'i' && said.get(e.fields.batchId);
    if (!su || hashOf(noSpot(su)) === hashOf(noSpot(e.fields.setup))) continue;
    e.node.fv = { ...e.node.fv, setup: vBump(fieldV(e, 'setup'), dev, now) };
    e.node.v = vBump(nodeV(e), dev, now); e.node.at = now;
    e.node.setup = noSpot(su);
    m.toA = m.toB = true;
  }
}
// A card put back as the other copy has it, in a saved library: a question she hasn't answered leaves the other copy as it was.
function libHold(text, held) {
  const l = JSON.parse(text);
  for (const e of libWalk(l).values()) if (held[e.id]) { for (const k of Object.keys(e.node)) delete e.node[k]; Object.assign(e.node, held[e.id]); }
  return JSON.stringify(l);
}
// Other saved things: comments saved for reuse are pooled, and anything else she hasn't got here comes in. Nothing she has here is replaced, unless she replaced it there later.
function mergeLs(a, b, skip = () => false) {
  const set = {}, parse = (t, d) => { try { return JSON.parse(t) || d; } catch { return d; } };
  // A saved rubric that was deleted stays deleted, unless it was saved again after: gs.rubricsGone = { id: time }.
  const ga = parse((a || {})['gs.rubricsGone'], {}), gb = parse((b || {})['gs.rubricsGone'], {}), gone = { ...ga };
  for (const [id, t] of Object.entries(gb)) if (!(gone[id] >= t)) gone[id] = t;
  const alive = r => !(gone[r.id] >= (r.at || 0));
  if (Object.keys(gone).some(id => gone[id] !== ga[id])) set['gs.rubricsGone'] = JSON.stringify(gone);
  if (!(b || {})['gs.rubrics'] && (a || {})['gs.rubrics']) { const x = parse(a['gs.rubrics'], []); if (Array.isArray(x) && !x.every(alive)) set['gs.rubrics'] = JSON.stringify(x.filter(alive)); }
  for (const [k, v] of Object.entries(b || {})) {
    if (k === 'gs.lib' || k === 'gs.rubricsGone' || skip(k)) continue;
    if (k === 'gs.bank') {
      let x = [], y = [];
      try { x = JSON.parse(a[k] || '[]'); y = JSON.parse(v); } catch {}
      const add = y.filter(t => !x.includes(t));
      if (add.length) set[k] = JSON.stringify(x.concat(add));
    } else if (k === 'gs.rubrics') {   // by id, and a rubric changed on both keeps the later one
      let x = [], y = [];
      try { x = JSON.parse(a[k] || '[]'); y = JSON.parse(v); } catch {}
      const by = new Map(x.filter(alive).map(r => [r.id, r])), n = by.size;
      let ch = n !== x.length;
      for (const r of y) { if (!alive(r)) continue; const o = by.get(r.id); if (!o || (r.at || 0) > (o.at || 0)) { by.set(r.id, r); ch = true; } }
      if (ch) set[k] = n || y.some(r => !alive(r)) ? JSON.stringify([...by.values()]) : v;
    } else if (k === 'gs.histSame') {   // her answers here stay, and answers made there come in
      let x = {}, y = {};
      try { x = JSON.parse(a[k] || '{}'); y = JSON.parse(v); } catch {}
      const add = Object.keys(y).filter(n => !(n in x));
      if (add.length) set[k] = a[k] == null ? v : JSON.stringify({ ...x, ...Object.fromEntries(add.map(n => [n, y[n]])) });
    } else if (k.startsWith('gs.rd.') && a[k] != null) {   // the Word document for a download, replaced there later
      const x = parse(a[k], {}), y = parse(v, {});
      if (y.at > (x.at || 0)) set[k] = v;
    } else if (a[k] == null) set[k] = v;
  }
  return set;
}

/* dated snapshots: every one from the last 2 weeks, one a week for 3 months before that, and the last 10 made before something risky */
function snapKeep(list, now) {
  const DAY = 864e5, keep = new Set(), weeks = new Set();
  const sorted = [...list].sort((a, b) => b.t - a.t);
  sorted.filter(s => s.why !== 'daily').slice(0, 10).forEach(s => keep.add(s.name));
  for (const s of sorted.filter(s => s.why === 'daily')) {
    const age = (now - s.t) / DAY;
    if (age <= 14) keep.add(s.name);
    else if (age <= 98) { const w = Math.floor(s.t / (7 * DAY)); if (!weeks.has(w)) { weeks.add(w); keep.add(s.name); } }
  }
  return keep;
}
