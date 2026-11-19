// The gradebook's boxes (src/book.js): a column's type, date and term (bkColMenu, bkSetCol), the types still to set (bkTypesDlg),
// Term setup for every class (bkSetupView, bkSetupSave) and Add scores without papers (bkAddView, bkAddSave, bkPaste). Every change
// is the current app's own: the lifted engine run on the library students/write.js hands in, as one undo step.
import { h, Fragment } from 'preact';
import { useState, useRef } from 'preact/hooks';
import { Dialog, Sheet, Button, IconButton, Segmented, Select, TextInput, Checkbox, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B, change, classIn } from '../../students/book.js';
import { fmtNum, roundPct } from '../../engines/gcore.js';
import { typeName } from './grades.jsx';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const hp = x => Math.round(+x * 2) / 2;
// An assignment card anywhere in the library, by id.
export function itemIn(l, id) {
  for (const u of l.classes.flatMap(c => c.units).concat(l.loose ? l.loose.units : [])) for (const it of u.items || []) if (it.id === id) return it;
  return null;
}
const catName = ([id, , s]) => typeName(id, s);
const xcWhere = (to, labelOf) => (to === 'ic' ? t('class.xc_ic', { type: labelOf('ic') }) : t('class.xc_term'));
const xcChoices = labelOf => [{ value: 'term', label: t('class.xc_term') }].concat(B.bkIsType('ic') ? [{ value: 'ic', label: t('class.xc_ic', { type: labelOf('ic') }) }] : []);

// A column's type, due date and term (bkSetCol): on its card, or for a download with no card, in the gradebook's own list.
export function setCol(col, part) {
  return change(t('class.u_col'), l => {
    const it = col.it && itemIn(l, col.it.id);
    if (it) Object.assign(it, part);
    else if (col.dl) { const book = l.book || (l.book = {}), dl = { ...(book.dl || {}) }; dl[col.dl] = { name: col.name, type: col.type, due: col.due, term: col.term, ...(dl[col.dl] || {}), ...part }; book.dl = dl; }
  });
}

// The column box: what bkColMenu shows, changed as she picks (the current app saves each choice at once too).
export function ColDialog({ col, conf, labelOf, onClose, onEditTyped, onEntry }) {
  const [v, setV] = useState({ type: col.type, due: col.due || '', term: col.term || '', xcTo: B.bkXcTo(col, conf) });
  const put = part => { setV(o => ({ ...o, ...part })); setCol(col, part); };
  const terms = conf.terms, byDate = (terms.find(x => x.id === B.bkTermOf({ ...col, due: v.due, term: '' }, terms)) || { name: t('class.term_none') }).name;
  return <Dialog open title={<span data-raw>{col.name}</span>} onClose={onClose} actions={<Button variant="primary" onClick={onClose} data-col-done>{t('class.done')}</Button>}>
    <div class="cp-col" data-col-box={col.key}>
      {col.type === 'xc'
        ? <div class="cp-fld"><span class="lab">{t('class.xc_adds')}</span><Segmented label={t('class.xc_adds')} value={v.xcTo} onChange={x => put({ xcTo: x })} options={xcChoices(labelOf)} /></div>
        : <div class="cp-fld"><span class="lab">{t('class.col_type')}</span><Segmented label={t('class.col_type')} value={v.type} onChange={x => put({ type: x })} options={B.bkCats().map(k => ({ value: k[0], label: catName(k) }))} /></div>}
      <TextInput type="date" label={t('class.due')} value={v.due} onInput={x => put({ due: x })} data-col-due />
      {terms.length > 0 && <Select label={t('class.term')} value={v.term} onChange={x => put({ term: x })} data-col-term
        options={[{ value: '', label: t('class.term_by_date', { term: byDate }) }].concat(terms.map(x => ({ value: x.id, label: x.name })))} />}
      {col.typed && col.it && !col.d && <Button size="sm" icon="edit" onClick={() => { onClose(); onEditTyped(col.it.id); }} data-col-typed>{t(col.type === 'xc' ? 'class.edit_xc' : 'class.edit_typed')}</Button>}
      {onEntry && col.type !== 'xc' && <Button size="sm" icon="menu" onClick={() => { onClose(); onEntry(col.key); }} data-col-entry>{t('class.mb_this')}</Button>}
    </div>
  </Dialog>;
}

// The one-time question (bkTypesDlg): every assignment in this class with no type yet, each with the usual three to choose from.
export function TypesDialog({ cols, onClose }) {
  const [picked, setPicked] = useState({});
  const left = useRef(cols).current;
  return <Dialog open title={t('class.types_title')} onClose={onClose} actions={<Button variant="primary" onClick={onClose}>{t('class.done')}</Button>}>
    <p class="mute small">{t('class.types_hint')}</p>
    <div class="cp-types">{left.map(col => <div class="cp-tyrow" data-type-row={col.key}><span><b data-raw>{col.name}</b> <span class="mute" data-raw>{col.due ? B.bkDay(col.due) : ''}</span></span>
      <Segmented size="sm" label={t('class.col_type')} value={picked[col.key] || ''} onChange={x => { setPicked(picked => ({ ...picked, [col.key]: x })); setCol(col, { type: x }); }}
        options={B.BK_TYPES.map(k => ({ value: k[0], label: catName(k) }))} /></div>)}</div>
  </Dialog>;
}

// Term setup (bkSetupView, bkSetupSave): the terms, the types and their weights, what an empty type does, extra credit, retakes.
export function SetupSheet({ conf, book, onClose }) {
  const use = B.bkTypeUse();
  const [terms, setTerms] = useState(() => conf.terms.map(x => ({ ...x })));
  const [cats, setCats] = useState(() => B.bkCats().map(([id, , s, k]) => ({ id, name: s, k, w: +conf.w[id] || 0 })));
  const [o, setO] = useState({ empty: conf.empty || 'other', xcTo: conf.xcTo || 'term', xcCap: conf.xcCap !== false, retake: ['last', 'avg'].includes((book || {}).retake) ? book.retake : 'high' });
  const sum = cats.reduce((a, c) => a + (+c.w || 0), 0);
  const isDef = id => B.BK_DEF.some(d => d[0] === id);
  const setCat = (i, part) => setCats(cats.map((c, j) => (j === i ? { ...c, ...part } : c)));
  const moveCat = (i, d) => { const a = cats.slice(), [x] = a.splice(i, 1); a.splice(i + d, 0, x); setCats(a); };
  const addCat = def => { const ks = cats.map(c => +c.k).filter(Boolean); setCats(cats.concat(def ? { id: def[0], name: def[2], w: 0 } : { id: 'c' + uid(), name: '', k: [1, 2, 3, 4, 5].find(x => !ks.includes(x)) || ks.length % 5 + 1, w: 0, fresh: true })); };
  const labelOf = id => { const c = cats.find(x => x.id === id); return c ? typeName(id, c.name) : typeName(id, ''); };
  const save = () => {
    const tt = terms.map(x => ({ id: x.id, name: (x.name || '').trim() || t('class.term'), start: x.start || '', end: x.end || '' })).filter(x => x.start || x.end || x.name).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
    const bad = tt.find(x => !x.start || !x.end || x.end < x.start);
    if (bad) return toast(t('class.bad_term', { name: bad.name }));
    const w = {}, out = [], names = new Set();
    for (const c of cats) {
      const d = B.BK_DEF.find(x => x[0] === c.id), nm = d && !c.renamed ? c.name : String(c.name || '').trim().replace(/\s+/g, ' ');
      if (!nm) return toast(t('class.type_needs_name'));
      if (names.has(nm.toLowerCase())) return toast(t('class.type_twice', { name: nm }));
      names.add(nm.toLowerCase());
      out.push({ id: c.id, ...(d && d[2] === nm ? {} : { name: nm }), ...(d ? {} : { k: +c.k || 1 }) });
      w[c.id] = Math.max(0, Math.min(100, +c.w || 0));
    }
    if (!out.length) return toast(t('class.keep_one_type'));
    if (!Object.values(w).some(v => v > 0)) return toast(t('class.some_weight'));
    const usual = out.length === B.BK_DEF.length && out.every((c, i) => c.id === B.BK_DEF[i][0] && !c.name);
    change(t('class.u_setup'), l => { l.book = { ...(l.book || {}), terms: tt, w, cats: usual ? undefined : out, empty: o.empty, xcTo: o.xcTo, xcCap: o.xcCap, retake: o.retake }; if (usual) delete l.book.cats; }, true);
    onClose();
  };
  const gone = B.BK_DEF.filter(d => !cats.some(c => c.id === d[0]));
  return <Sheet open wide title={t('class.setup_title')} onClose={onClose}
    footer={<><span class="mute small">{t('class.for_all')}</span><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-setup-save>{t('common.save')}</Button></>}>
    <div class="cp-setup" data-setup>
      <section><h3>{t('class.terms')}</h3>
        {terms.length > 0 && <div class="cp-trow head mute small"><span>{t('class.term_name')}</span><span>{t('class.starts')}</span><span>{t('class.ends')}</span><span /></div>}
        {terms.map((x, i) => <div class="cp-trow" data-term-row={i}>
          <input class="input" value={x.name} aria-label={t('class.term_name')} onInput={e => setTerms(terms.map((y, j) => (j === i ? { ...y, name: e.currentTarget.value } : y)))} data-tf="name" />
          <input class="input" type="date" value={x.start} aria-label={t('class.starts')} onInput={e => setTerms(terms.map((y, j) => (j === i ? { ...y, start: e.currentTarget.value } : y)))} data-tf="start" />
          <input class="input" type="date" value={x.end} aria-label={t('class.ends')} onInput={e => setTerms(terms.map((y, j) => (j === i ? { ...y, end: e.currentTarget.value } : y)))} data-tf="end" />
          <IconButton icon="x" label={t('class.remove_term')} onClick={() => setTerms(terms.filter((_, j) => j !== i))} /></div>)}
        <Button size="sm" icon="plus" onClick={() => setTerms(terms.concat({ id: uid(), name: t('class.new_term', { n: terms.length + 1 }), start: '', end: '' }))} data-term-add>{t('class.add_term')}</Button>
        <p class="mute small">{t('class.terms_hint')}</p></section>
      <section><h3>{t('class.types_w')}</h3>
        {cats.map((c, i) => <div class="cp-crow" data-cat={c.id}>
          <span class="mv"><IconButton size="sm" icon="chu" label={t('class.move_up')} disabled={!i} onClick={() => moveCat(i, -1)} /><IconButton size="sm" icon="chd" label={t('class.move_down')} disabled={i === cats.length - 1} onClick={() => moveCat(i, 1)} /></span>
          <span class="nm"><input class="input" value={isDef(c.id) && !c.renamed ? labelOf(c.id) : c.name} maxLength={40} placeholder={t('class.type_ph')} aria-label={t('class.type_name')} autofocus={c.fresh}
            onInput={e => setCat(i, { name: e.currentTarget.value, renamed: true })} data-cname />{c.id === 'fm' && <small class="mute">{t('class.fm_note')}</small>}</span>
          <label class="pnum"><input class="input" type="number" min="0" max="100" step="1" value={c.w} aria-label={t('class.pct_grade')} onInput={e => setCat(i, { w: e.currentTarget.value })} data-wt={c.id} />%</label>
          <IconButton icon="x" label={use.get(c.id) ? t('class.type_used', { n: use.get(c.id) }) : t('class.remove_type')} disabled={!!use.get(c.id)} onClick={() => setCats(cats.filter((_, j) => j !== i))} /></div>)}
        <div class="cp-cadd"><Button size="sm" icon="plus" onClick={() => addCat()} data-cat-add>{t('class.add_type')}</Button>{gone.map(d => <Button size="sm" onClick={() => addCat(d)}>{t('class.add_back', { type: typeName(d[0], '') })}</Button>)}</div>
        <p class="mute small" data-wsum>{sum === 100 ? t('class.w_100') : t('class.w_sum', { n: sum })}</p>
        <p class="mute small">{t('class.types_hint2')}</p>
        <h4>{t('class.empty_t')}</h4>
        <Segmented size="sm" label={t('class.empty_t')} value={o.empty} onChange={x => setO(o => ({ ...o, empty: x }))} options={[{ value: 'other', label: t('class.empty_other') }, { value: 'zero', label: t('class.empty_zero') }]} />
        <h4>{t('class.xc_t')}</h4>
        <Segmented size="sm" label={t('class.xc_new')} value={o.xcTo} onChange={x => setO(o => ({ ...o, xcTo: x }))} options={xcChoices(labelOf)} />
        <Segmented size="sm" label={t('class.above_100')} value={o.xcCap ? 'cap' : 'over'} onChange={x => setO(o => ({ ...o, xcCap: x === 'cap' }))} options={[{ value: 'cap', label: t('class.cap') }, { value: 'over', label: t('class.over') }]} />
        <h4>{t('class.retakes')}</h4>
        <Segmented size="sm" label={t('class.retake_rule')} value={o.retake} onChange={x => setO(o => ({ ...o, retake: x }))} options={[{ value: 'high', label: t('class.rk_high') }, { value: 'last', label: t('class.rk_last') }, { value: 'avg', label: t('class.rk_avg') }]} />
      </section>
    </div>
  </Sheet>;
}

// Add scores without papers (bkAddView): a new column, or a typed-in one changed; extra credit; a pasted column of scores.
export function AddSheet({ c, cols, conf, labelOf, itId, xc: wantXc, onClose }) {
  const it = itId ? cols.find(k => k.it && k.it.id === itId)?.it : null;
  const ty0 = it && it.typed;
  const [a, setA] = useState(() => ({ name: it ? it.name : '', due: (it && it.due) || B.isoDay(Date.now()), unit: c.units[0] ? c.units[0].id : '',
    type: B.bkType(it && it.type) || (wantXc ? 'xc' : B.bkIsType('ic') ? 'ic' : (B.bkCats().filter(k => k[0] !== 'fm')[0] || B.BK_TYPES[0])[0]),
    mode: ty0 && !ty0.max && it.type !== 'xc' ? 'pct' : 'pts', max: ty0 && ty0.max ? ty0.max : 20, xcTo: (it && it.xcTo) || conf.xcTo || 'term', give: 1 }));
  const [s, setS] = useState(() => JSON.parse(JSON.stringify((ty0 && ty0.s) || {})));
  const [note, setNote] = useState(''), [err, setErr] = useState('');
  // a card with copies in linked classes (src/linked.js lkAlsoHtml): its name, type and due date can go to them too
  const tw = it && it.group ? B.lkTwins(it) : [], [also, setAlso] = useState(true);
  const xc = a.type === 'xc', fm = a.type === 'fm', max = a.mode === 'pct' ? null : Math.max(0.5, +a.max || 0) || null;
  const empty = c.units.flatMap(u => u.items).filter(x => !x.typed && !x.batchId && x.type !== 'xc' && x.name && !cols.some(k => k.key === x.id));
  const setOne = (n, part) => setS(s => ({ ...s, [n]: { ...(s[n] || {}), ...part } }));
  const stBtn = (n, st) => setS(s => { const r = s[n] || {}; return { ...s, [n]: { ...r, st: r.st === st ? '' : st, v: st === 'late' || r.st === st ? r.v : null } }; });
  const paste = text => {
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean), num = x => { const m = String(x).replace(',', '.').match(/^-?\d+(\.\d+)?/); return m ? +m[0] : null; };
    const named = lines.map(l => { const cells = l.split(/\t|,(?!\d)|;/).map(x => x.trim()).filter(Boolean), last = cells[cells.length - 1]; return cells.length > 1 && num(last) != null && isNaN(+cells[0]) ? { name: cells.slice(0, -1).join(' '), v: num(last) } : null; });
    const out = { ...s }, left = [];
    if (named.length && named.every(Boolean)) {
      const pairs = B.rosterPairs(c.names, named.map(x => x.name)), back = new Map([...pairs].map(([r, k]) => [k, r]));
      for (const x of named) { const r = back.get(x.name); if (r) out[r] = { ...(out[r] || {}), v: x.v }; else left.push(x.name); }
    } else lines.slice(0, c.names.length).forEach((l, i) => { const m = /^(missing|m)$/i.test(l); out[c.names[i]] = m ? { st: 'missing' } : { ...(out[c.names[i]] || {}), v: num(l) }; });
    setS(out);
    setNote(left.length ? t('class.paste_left', { names: left.join(', ') }) : lines.length > c.names.length && !named.every(Boolean) ? t('class.paste_over') : t('class.pasted_check'));
  };
  const save = () => {
    const name = a.name.trim(); if (!name) { setErr(t('class.name_needed_asg')); return; }
    const out = {}, keepP = !!(ty0 && max && ty0.max === max);
    if (xc) for (const [n, r] of Object.entries(s)) { const v = r.v === '' || r.v == null || isNaN(+r.v) ? 0 : hp(r.v); if (v > 0) out[n] = { v }; }
    else for (const [n, r] of Object.entries(s)) {
      const v = fm || r.v === '' || r.v == null || isNaN(+r.v) ? null : hp(r.v);
      if (fm ? r.fb || r.st : v != null || r.st) out[n] = fm && r.fb ? { v: null, st: r.st || '', fb: true } : { v, st: r.st || '' };
      if (out[n] && !fm && v != null && r.tries && r.tries.length) out[n].tries = r.tries;
      if (out[n] && !fm && v != null && +r.xc > 0) out[n].xc = r.xc;
      const o = ty0 && ty0.s && ty0.s[n];
      if (out[n] && !fm && v != null && r.p != null && keepP && o && o.v === +r.v) { out[n].v = o.v; out[n].p = r.p; }
    }
    const unitTyped = t('class.unit_typed'), unit1 = t('class.unit_1');
    change(t(it ? 'class.u_typed' : 'class.u_add'), l => {
      const k = classIn(l, c.id); if (!k) return;
      const was = it && itemIn(l, it.id), typed = B.typedStamp(was && was.typed, { max: xc ? null : max, s: out });
      const card = !was && k.units.flatMap(u => u.items).find(x => !x.typed && !x.batchId && x.type !== 'xc' && x.name && x.name.trim().toLowerCase() === name.toLowerCase() && empty.some(e => e.id === x.id));
      if (card) Object.assign(card, { type: card.type || a.type, due: card.due || a.due, typed });
      else if (was) { const old = { name: was.name, type: was.type, due: was.due }; Object.assign(was, { name, type: a.type, due: a.due, typed }); if (xc) was.xcTo = a.xcTo; else delete was.xcTo;
        if (also && tw.length && was.group) for (const h of [...l.classes, l.loose].filter(Boolean)) for (const u of h.units || []) for (const x of u.items) if (x !== was && x.group === was.group) for (const k of ['name', 'type', 'due']) if (was[k] !== old[k]) { if (was[k] == null) delete x[k]; else x[k] = was[k]; } }
      else {
        let u = k.units.find(x => x.id === a.unit);
        if (!u) k.units.push(u = { id: uid(), name: k.units.length ? unitTyped : unit1, items: [] });
        u.items.push({ id: uid(), name, classId: k.id, type: a.type, due: a.due, typed, ...(xc ? { xcTo: a.xcTo } : {}) });
      }
    }, true);
    onClose(true);
  };
  const entered = xc ? c.names.filter(n => +((s[n] || {}).v) > 0).length : fm ? c.names.filter(n => (s[n] || {}).fb).length : c.names.filter(n => { const r = s[n]; return r && ((r.v != null && r.v !== '') || r.st === 'missing' || r.st === 'excused'); }).length;
  const st3 = n => <div class="seg sm" role="group" aria-label={t('class.mark_as')}>{[['missing', t('class.missing')], ['excused', t('class.excused')], ['late', t('class.late')]].map(([k, l]) => <button type="button" aria-pressed={String((s[n] || {}).st === k)} onClick={() => stBtn(n, k)} data-ast={k}>{l}</button>)}</div>;
  return <Sheet open wide title={it ? t('class.typed_title', { name: it.name }) : t('class.add_title', { name: c.name })} onClose={() => onClose(false)}
    footer={<><span class="mute small" data-add-count>{t(xc ? 'class.n_xc' : fm ? 'class.n_complete' : 'class.n_entered', { n: entered, total: c.names.length })}</span><span class="grow" />
      <Button onClick={() => onClose(false)}>{t('common.cancel')}</Button><Button variant="primary" onClick={save} data-add-save>{t(it ? 'class.save_scores' : 'class.add_to_book')}</Button></>}>
    <div class="cp-add" data-add>
      <div class="cp-addgrid">
        <TextInput label={t('class.asg')} value={a.name} onInput={x => setA(a => ({ ...a, name: x }))} error={err} placeholder={t('class.asg_ph')} list="cp-cards" autofocus={!it} data-add-name
          onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }} />
        <datalist id="cp-cards">{!it && empty.map(x => <option value={x.name} />)}</datalist>
        <div class="cp-fld"><span class="lab">{t('class.col_type')}</span><Segmented size="sm" label={t('class.col_type')} value={a.type} onChange={x => setA(a => ({ ...a, type: x }))} options={B.bkCats().concat([['xc']]).map(k => ({ value: k[0], label: k[0] === 'xc' ? t('class.type_xc') : catName(k) }))} /></div>
        <TextInput type="date" label={t('class.due')} value={a.due} onInput={x => setA(a => ({ ...a, due: x }))} data-add-due />
        {!it && <Select label={t('class.unit')} value={a.unit} onChange={x => setA(a => ({ ...a, unit: x }))} options={c.units.map(u => ({ value: u.id, label: u.name })).concat({ value: '', label: t(c.units.length ? 'class.new_unit_typed' : 'class.new_unit_1') })} />}
        {!xc && !fm && <div class="cp-fld"><span class="lab">{t('class.scored_as')}</span><div class="cp-so"><Segmented size="sm" label={t('class.scored_as')} value={a.mode} onChange={x => setA(a => ({ ...a, mode: x }))} options={[{ value: 'pts', label: t('class.pts_out_of') }, { value: 'pct', label: t('class.percent') }]} />
          {a.mode === 'pts' && <input class="input cp-max" type="number" min="0.5" step="0.5" value={a.max} aria-label={t('class.out_of_l')} onInput={e => { const max = e.currentTarget.value; setA(a => ({ ...a, max })); }}
            onKeyDown={e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); save(); } }} data-add-max />}</div></div>}
        {xc && <div class="cp-fld"><span class="lab">{t('class.adds_to')}</span><Segmented size="sm" label={t('class.adds_to')} value={a.xcTo} onChange={x => setA(a => ({ ...a, xcTo: x }))} options={xcChoices(labelOf)} /></div>}
      </div>
      {tw.length > 0 && <span data-add-also><Checkbox label={t('class.lk_also_do', { names: tw.map(x => x.c.name || t('nav.no_class')).join(', ') })} checked={also} onChange={setAlso} /></span>}
      {xc && <><div class="cp-xcall"><span>{t('class.give')}</span><input class="input cp-sc" type="number" step="0.5" min="0" value={a.give} aria-label={t('class.give_pts')} onInput={e => { const give = e.currentTarget.value; setA(a => ({ ...a, give })); }} /><span>{t('class.points_to')}</span>
        <Button size="sm" onClick={() => { const v = Math.max(0, hp(a.give)) || 0, o = { ...s }; for (const n of c.names) o[n] = { v }; setS(o); }}>{t('class.give_all')}</Button>
        <Button size="sm" onClick={() => { const v = Math.max(0, hp(a.give)) || 0, o = { ...s }; for (const n of c.names) if (!(+((o[n] || {}).v) > 0)) o[n] = { v }; setS(o); }}>{t('class.give_none')}</Button>
        <Button size="sm" variant="quiet" onClick={() => setS({})}>{t('class.clear_all')}</Button></div>
        <p class="mute small">{t(a.xcTo === 'ic' ? 'class.xc_each_ic' : 'class.xc_each', { where: xcWhere(a.xcTo, labelOf) })}</p></>}
      {!xc && !fm && <><textarea class="input cp-paste" rows="2" placeholder={t('class.paste_ph')} aria-label={t('class.paste_ph')} onPaste={e => { e.preventDefault(); paste(e.clipboardData.getData('text')); }} data-add-paste />
        {note && <p class="mute small" role="status" data-add-note>{note}</p>}</>}
      <table class="cp-ent"><thead><tr><th>{t('class.student')}</th><th>{xc ? t('class.type_xc') : fm ? t('class.fb_complete') : t('class.score')}</th><th class="r">{xc ? t('class.adds') : fm ? '' : t('class.percent')}</th><th>{xc ? '' : t('class.mark_as')}</th></tr></thead>
        <tbody>{c.names.map(n => { const r = s[n] || {}, v = r.v != null ? r.v : '', off = r.st === 'missing' || r.st === 'excused';
          if (xc) return <tr><td data-raw>{n}</td><td><input class="input cp-sc" type="number" step="0.5" min="0" value={+v > 0 ? v : ''} aria-label={t('class.xc_for', { name: n })} onInput={e => setOne(n, { v: e.currentTarget.value })} data-add-v /> {t('class.points')}</td>
            <td class="r mute">{+v > 0 ? (a.xcTo === 'ic' ? t('class.xc_say_ic', { n: fmtNum(+v), type: labelOf('ic') }) : t('class.xc_say_term', { n: fmtNum(+v) })) : ''}</td><td /></tr>;
          if (fm) return <tr><td data-raw>{n}</td><td><Checkbox label={t('class.complete')} checked={!!r.fb} disabled={off} onChange={x => setOne(n, { fb: x })} /></td><td />{<td>{st3(n)}</td>}</tr>;
          const p = v === '' || v == null || isNaN(+v) ? '' : (max ? roundPct(+v / max * 100) : roundPct(+v)) + '%';
          return <tr><td data-raw>{n}</td><td><input class="input cp-sc" type="number" step="0.5" min="0" value={v} disabled={off} aria-label={t('class.cell_label', { name: n })} onInput={e => setOne(n, { v: e.currentTarget.value })} data-add-v /> {max ? '/ ' + fmtNum(max) : '%'}</td>
            <td class="r mute">{p}</td><td>{st3(n)}</td></tr>; })}</tbody></table>
    </div>
  </Sheet>;
}
