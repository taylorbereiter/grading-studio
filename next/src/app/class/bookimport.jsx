// A gradebook imported from a spreadsheet (src/bookimport.js): a teacher who starts mid-year brings their old gradebook in as
// typed-in cards, one per column. The file is read in this browser (CSV, TSV, Excel or cells pasted) by the lifted engine (gbki):
// its rows and columns found, each column matched to an assignment already in the class, a category to a type, each row to the
// roster. Nothing is saved until Import, and then as one undo step; a score already there stays unless she says otherwise.
import { h, Fragment } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { Sheet, Button, Select, Checkbox, Segmented, toast } from '../../ui/index.js';
import { t } from '../../i18n/t.js';
import { engine as B, change, classIn } from '../../students/book.js';
import * as G from '../../engines/gbki.js';
import { use as coreUse, state as coreState, fmtNum } from '../../engines/gcore.js';
import { undo as undoLast } from '../../services/undo.js';
import { PARTS } from '../router.js';
import { typeName } from './grades.jsx';
import './lines.js';

const uid = () => Math.random().toString(36).slice(2, 10);
const SUM = G.BKI_SUM;
const same = (a, b) => (a.st || '') === (b.st || '') && (a.v == null ? null : +a.v) === (b.v == null ? null : +b.v);
// A file cell as it will be stored on a scale (bkiVal): max points, or null for percents; of: what the file says it is out of.
function valOf(cell, max, of) {
  if (!cell || cell.bad) return null;
  if (cell.st === 'missing' || cell.st === 'excused') return { v: null, st: cell.st };
  let v;
  if (cell.pct != null) v = max ? cell.pct / 100 * max : cell.pct;
  else if (cell.of && cell.of !== max) v = max ? cell.v / cell.of * max : cell.v / cell.of * 100;
  else if (of && of !== max) v = max ? cell.v / of * max : cell.v / of * 100;
  else v = cell.v;
  return { v: Math.max(0, Math.round(v * 2) / 2), st: cell.st || '' };
}

export function ImportSheet({ x, rows: given, onClose }) {
  const { c } = x, file = useRef(null);
  const [s, setS] = useState({ data: null, pick: {}, keep: true, over: {}, unit: '', all: '', cats: {}, info: true, err: '' });
  const set = part => setS(o => ({ ...o, ...part }));
  const items = c.units.flatMap(u => u.items);
  const ex = items.filter(it => it.type !== 'xc' && !(it.typed && it.typed.lv)).map(it => ({ it, name: it.name, due: it.due || '' }));
  const itOf = id => items.find(it => it.id === id) || null;
  const labelOf = id => { if (id && id.startsWith('+:')) return t('class.bki_new_type_n', { name: id.slice(2) }); const k = B.bkCats().find(y => y[0] === id); return typeName(id, k && k[2]); };

  // The file read (bkiTake): rows matched to the roster, columns to assignments, categories to types.
  const take = rows => {
    const r = G.bkiRead(rows || []);
    if (!r || r.err) return set({ err: t(r && r.err === 'none' ? 'class.bki_no_names' : 'class.bki_empty') });
    if (!r.cols.length) return set({ err: t('class.bki_no_scores') });
    const pairs = B.rosterPairs(c.names, r.students.map(st => st.name));
    r.match = new Map([...pairs].map(([n, k]) => [k, n]));
    const pick = {}, build = !c.names.length, cats = {};
    if (build) { const seen = new Set(); r.students.forEach((st, i) => { const k = G.normName(st.name); pick[i] = seen.has(k) ? '' : '+'; seen.add(k); }); }
    G.bkiMatch(r.cols, ex);
    for (const col of r.cols) {
      if (col.cat) { if (!(col.cat in cats)) cats[col.cat] = G.bkiCatGuess(col.cat); col.type = cats[col.cat]; }
      const to = col.to && ex.find(y => y.it.id === col.to); if (to && !col.due) col.due = to.due || '';
    }
    setS(s => ({ ...s, data: r, pick, over: {}, cats, build, err: '' }));
  };
  useEffect(() => { if (given) take(given); }, []);   // a Google Classroom file read on the way in
  const readFile = async f => {
    if (!f) return;
    try {
      const buf = new Uint8Array(await f.arrayBuffer());
      if (buf[0] === 0x50 && buf[1] === 0x4b) { if (!coreState().fflate) coreUse({ fflate: await PARTS.zip() }); let rows; try { rows = G.bkiXlsx(buf); } catch { return set({ err: t('class.bki_xlsx_bad') }); } return take(rows); }
      if (buf[0] === 0xd0 && buf[1] === 0xcf) return set({ err: t('class.bki_xls_old') });
      take(G.bkiParse(new TextDecoder().decode(buf)));
    } catch { set({ err: t('class.bki_unread') }); }
  };

  const d = s.data;
  const plusOk = i => { const k = G.normName(d.students[i].name); return !c.names.some(n => G.normName(n) === k) && !d.students.some((st, j) => i > j && s.pick[j] === '+' && G.normName(st.name) === k); };
  const whoOf = (st, i) => { const p = Object.prototype.hasOwnProperty.call(s.pick, i) ? s.pick[i] : d.match.get(st.name) || ''; return p === '+' ? (plusOk(i) ? st.name : '') : p; };
  // An assignment already there keeps its own scale (bkiFixed): its typed-in one, or what its graded papers are out of.
  const fixed = col => {
    if (!col.to) return undefined;
    const it = itOf(col.to); if (it && it.typed) return it.typed.max || null;
    const k = x.cols.find(y => y.key === col.to), cell = k && [...k.cells.values()].find(y => !y.typed && y.max > 0);
    return cell ? cell.max : undefined;
  };
  const maxOf = col => { const f = fixed(col); return f !== undefined ? f : col.pct ? null : col.max; };
  const useFile = (col, who) => { const o = s.over[col.i + '|' + who]; return o ? o === 'file' : !s.keep; };
  const plan = () => d.cols.filter(col => col.on).map(col => {
    const max = maxOf(col), it = col.to ? itOf(col.to) : null, old = (it && it.typed && it.typed.s) || {}, out = {}, clash = [];
    const exCol = col.to ? x.cols.find(y => y.key === col.to) : null, fb = (it ? it.type : col.type) === 'fm';
    let papers = 0;
    d.students.forEach((st, i) => {
      const who = whoOf(st, i); if (!who) return;
      const v = valOf(G.bkiCell(st.cells[col.i]), max, fixed(col) !== undefined && col.how !== 'guess' && !col.pct ? col.max : null); if (!v) return;
      const gc = exCol && exCol.cells.get(who);
      if (gc && !gc.typed && (gc.pct != null || gc.st)) { papers++; return; }
      if (old[who] && (old[who].v != null || old[who].st || old[who].fb) && !same(old[who], v)) clash.push({ who, was: old[who], now: v });
      out[who] = fb ? { ...v, fb: true } : v;
    });
    return { col, max, it, s: out, old, clash, papers };
  });
  const info = () => {
    const add = [], differ = [];
    d.students.forEach((st, i) => { const who = whoOf(st, i), had = (who && c.info && c.info[who]) || {}; if (!who) return;
      for (const k of ['id', 'email']) if (st[k]) { if (!had[k]) add.push([who, k, st[k]]); else if (String(had[k]).toLowerCase() !== st[k].toLowerCase()) differ.push(who); } });
    return { add, differ };
  };
  const show = (r, max) => (r.st === 'missing' ? t('class.missing') : r.st === 'excused' ? t('class.excused') : r.v == null ? '–' : fmtNum(r.v) + (max ? '/' + fmtNum(max) : '%') + (r.st === 'late' ? ' · ' + t('class.late') : ''));
  const colSet = (col, part) => { Object.assign(col, part); setS(s => ({ ...s })); };

  const save = () => {
    const p = plan(); if (!p.length || p.some(q => q.col.to === null)) return;
    const bad = p.find(q => fixed(q.col) === undefined && !q.col.pct && !(q.col.max > 0));
    if (bad) return toast(t('class.bki_say_max', { name: bad.col.name }));
    const added = d.students.filter((st, i) => s.pick[i] === '+' && plusOk(i)).map(st => st.name), fill = s.info && (d.ids || d.mails) ? info().add : [];
    change(t('class.u_import'), l => {
      const k = classIn(l, c.id); if (!k) return;
      // new types first, as her own (lib.book.cats holds the whole list once it differs from the usual three)
      const made = {}, want = [...new Set(p.filter(q => !q.it || !q.it.type).map(q => q.col.type).filter(y => y && y.startsWith('+:')))];
      if (want.length) {
        const b = l.book || {}, list = (Array.isArray(b.cats) ? b.cats : B.BK_DEF.map(([id]) => ({ id }))).slice();
        for (const y of want) { const id = 'c' + uid(); made[y] = id; list.push({ id, name: y.slice(2), k: list.filter(z => z.k).length % 5 + 1 }); }
        l.book = { ...b, cats: list };
      }
      k.names.push(...added);
      for (const [who, key, v] of fill) B.setInfo(k, who, { [key]: v });
      let u = null;
      for (const q of p) {
        const col = q.col, name = col.name.trim() || col.head, type = made[col.type] || col.type;
        let it = q.it && k.units.flatMap(z => z.items).find(z => z.id === q.it.id);
        if (it) {
          const out = { ...q.old };
          for (const [who, v] of Object.entries(q.s)) { const was = q.old[who]; if (!was || (was.v == null && !was.st) || same(was, v) || useFile(col, who)) out[who] = v; }
          it.typed = B.typedStamp(it.typed, { max: q.max, s: out });
          if (!it.type) it.type = type;
          if (!it.due && col.due) it.due = col.due;
        } else {
          if (!u) { u = k.units.find(z => z.id === s.unit); if (!u) k.units.push(u = { id: uid(), name: t('class.bki_unit'), items: [] }); }
          u.items.push(it = { id: uid(), name, classId: k.id, type, due: col.due, typed: B.typedStamp(null, { max: q.max, s: q.s }) });
        }
      }
    }, true);
    toast(t('class.bki_done', { n: p.length }) + (added.length ? ' ' + t('class.bki_done_stu', { n: added.length }) : ''), { undo: undoLast });
    onClose();
  };

  if (!d) return <Sheet open wide title={t('class.bki_title', { name: c.name })} onClose={onClose} footer={<><span class="grow" /><Button onClick={onClose}>{t('common.cancel')}</Button></>}>
    <div class="cp-bki" data-bki>
      <p class="mute small">{t('class.bki_say')}</p>
      <div class="cp-bkidrop"><Button variant="primary" icon="upload" onClick={() => file.current.click()} data-bki-file>{t('class.bki_choose')}</Button><span class="mute small">{t('class.bki_kinds')}</span>
        <input ref={file} type="file" hidden accept=".csv,.tsv,.txt,.xlsx,text/csv,text/tab-separated-values,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={e => { readFile(e.currentTarget.files[0]); e.currentTarget.value = ''; }} data-bki-input /></div>
      <textarea class="input cp-paste" rows="3" placeholder={t('class.bki_paste_ph')} aria-label={t('class.bki_paste')} onPaste={e => { e.preventDefault(); take(G.bkiParse((e.clipboardData || window.clipboardData).getData('text'))); }} data-bki-paste />
      {s.err && <p class="cp-err" role="alert" data-bki-err>{s.err}</p>}
    </div>
  </Sheet>;

  const p = plan(), clash = p.flatMap(q => q.clash.map(y => [q, y]));
  const rows = d.students.map((st, i) => [st, i, whoOf(st, i)]), matched = rows.filter(r => r[2]), unmatched = rows.filter(r => !r[2] || s.pick[r[1]] === '+');
  const added = rows.filter(r => s.pick[r[1]] === '+'), taken = new Set(matched.map(r => r[2])), absent = c.names.filter(n => !taken.has(n));
  const newTypes = [...new Set(Object.values(s.cats).concat(d.cols.map(y => y.type)).filter(y => y && y.startsWith('+:')))];
  const typeOpts = B.bkCats().map(([id]) => ({ value: id, label: labelOf(id) })).concat(newTypes.map(y => ({ value: y, label: labelOf(y) })));
  const usedBy = new Map(d.cols.filter(y => y.on && y.to).map(y => [y.to, y.i]));
  const ask = d.cols.filter(y => y.on && y.to === null).length, n = d.cols.filter(y => y.on).length, cats = Object.keys(s.cats);
  const inf = (d.ids || d.mails) ? info() : null, nScores = p.reduce((a, q) => a + Object.keys(q.s).length, 0), papers = p.reduce((a, q) => a + q.papers, 0);
  const found = col => { const cs = d.students.map(st => G.bkiCell(st.cells[col.i])).filter(Boolean), sc = cs.filter(y => y.v != null || y.pct != null).length, m = cs.filter(y => y.st === 'missing').length, e = cs.filter(y => y.st === 'excused').length;
    return [t('class.bki_n_scores', { n: sc }), m ? t('class.bki_n_missing', { n: m }) : '', e ? t('class.bki_n_excused', { n: e }) : '', col.bad ? t('class.bki_n_unread', { n: col.bad }) : ''].filter(Boolean).join(', '); };
  const goes = col => {
    const v = !col.on ? 'skip' : col.to === null ? '' : col.to || 'new';
    const sug = col.opts.map(id => ex.find(y => y.it.id === id)).filter(Boolean), rest = ex.filter(y => !col.opts.includes(y.it.id));
    const opt = y => ({ value: y.it.id, label: t('class.bki_same_as', { name: y.it.name }), disabled: usedBy.has(y.it.id) && usedBy.get(y.it.id) !== col.i });
    const options = (v === '' ? [{ value: '', label: t('class.bki_choose_go') }] : []).concat(sug.map(opt), [{ value: 'new', label: t('class.bki_new') }, { value: 'skip', label: t('class.bki_skip') }], rest.map(opt));
    return <Select value={v} options={options} aria-label={t('class.bki_goes', { name: col.name })} data-bki-go={col.i}
      onChange={val => { if (val === 'skip') colSet(col, { on: false }); else { const to = val === 'new' ? '' : val, it = to && itOf(to); colSet(col, { on: true, to, sure: 2, ...(it && it.due ? { due: it.due } : {}) }); } }} />;
  };
  const scale = col => {
    const f = fixed(col);
    if (f !== undefined) return <span class="mute small">{f ? t('class.bki_out_of_now', { n: fmtNum(f) }) : t('class.bki_pct_now')}</span>;
    return <span class="cp-bkisc"><Select value={col.pct ? 'pct' : 'pts'} options={[{ value: 'pts', label: t('class.bki_pts') }, { value: 'pct', label: t('class.show_pct') }]} aria-label={t('class.bki_scored')} onChange={v => colSet(col, { pct: v === 'pct', max: v === 'pts' && !col.max ? 20 : col.max, how: '' })} />
      {!col.pct && <input class="input cp-max" type="number" min="0.5" step="0.5" value={col.max || ''} aria-label={t('class.out_of_label')} onInput={e => colSet(col, { max: Math.max(0.5, Math.round(+e.currentTarget.value * 2) / 2) || null, how: '' })} data-bki-max={col.i} />}
      {col.how === 'guess' && <span class="tag" title={t('class.bki_guess_say')}>{t('class.bki_check')}</span>}</span>;
  };
  const order = d.cols.slice().sort((a, b) => (a.on && a.to === null ? 0 : a.on && a.sure === 1 && a.to ? 1 : 2) - (b.on && b.to === null ? 0 : b.on && b.sure === 1 && b.to ? 1 : 2));
  return <Sheet open wide title={t('class.bki_title', { name: c.name })} onClose={onClose}
    footer={<><span class="mute small" data-bki-count>{ask ? t('class.bki_ask_first', { n: ask }) : n ? t('class.bki_count', { n: nScores }) + ' · ' + t('class.bki_count_stu', { n: matched.length }) : ''}</span><span class="grow" />
      <Button onClick={onClose}>{t('common.cancel')}</Button><Button variant="primary" disabled={!n || !matched.length || !!ask} onClick={save} data-bki-save>{n ? t('class.bki_import_n', { n }) : t('class.bki_import')}</Button></>}>
    <div class="cp-bki" data-bki>
      <p>{t('class.bki_found', { n: d.cols.length })} {t('class.bki_found_stu', { n: d.students.length })} {s.build ? t('class.bki_build') : t('class.bki_matched', { n: matched.length - added.length })} <button type="button" class="link" onClick={() => set({ data: null })} data-bki-again>{t('class.bki_again')}</button></p>
      {cats.length > 0 && <><h3>{t('class.bki_cats')}</h3><p class="mute small">{t('class.bki_cats_say')}</p>
        <table class="cp-ent"><tbody>{cats.map(k => <tr><td data-raw>{k}</td><td><Select value={s.cats[k]} aria-label={t('class.bki_type_for', { name: k })} options={B.bkCats().map(([id]) => ({ value: id, label: labelOf(id) })).concat({ value: '+:' + k, label: labelOf('+:' + k) })}
          onChange={v => { for (const col of d.cols) if (col.cat === k && !col.typeSet) col.type = v; set({ cats: { ...s.cats, [k]: v } }); }} /></td></tr>)}</tbody></table>
        {newTypes.length > 0 && <p class="mute small">{t('class.bki_new_type_say')}</p>}</>}
      <h3>{t('class.bki_asg')}</h3>
      {ask > 0 && <p class="small"><b>{t('class.bki_close', { n: ask })}</b> {t('class.bki_close_say')}</p>}
      <div class="cp-bkiw"><table class="cp-ent cp-bkit" data-bki-cols><thead><tr><th>{t('class.bki_in_file')}</th><th>{t('class.bki_goes_to')}</th><th>{t('class.bki_type')}</th><th>{t('class.due')}</th><th>{t('class.bki_scored')}</th><th>{t('class.bki_scores')}</th></tr></thead>
        <tbody>{order.map(col => { const it = col.to && itOf(col.to);
          return <tr class={col.on ? '' : 'off'} data-bki-col={col.i}><td><input class="input" value={col.name} maxLength={80} aria-label={t('class.bki_name')} disabled={!!col.to || !col.on} onInput={e => { col.name = e.currentTarget.value; }} data-raw />{SUM.test(col.head) && !col.on && <small class="mute">{t('class.bki_total')}</small>}</td>
            <td>{goes(col)}{col.on && col.to && col.sure === 1 && <span class="tag" title={t('class.bki_close_tag')}>{t('class.bki_check')}</span>}</td>
            <td>{col.on ? it && it.type ? <span class="mute">{labelOf(it.type)}</span> : <Select value={col.type} options={typeOpts} aria-label={t('class.bki_type')} onChange={v => colSet(col, { type: v, typeSet: true })} /> : null}</td>
            <td>{col.on && <input class="input" type="date" value={col.due} aria-label={t('class.due')} onInput={e => { col.due = e.currentTarget.value; }} />}</td>
            <td>{col.on && scale(col)}</td><td class="mute small">{found(col)}</td></tr>; })}</tbody></table></div>
      <div class="cp-addgrid"><label class="cp-bkiall"><span>{t('class.bki_all_date')}</span><input class="input" type="date" value={s.all} onInput={e => set({ all: e.currentTarget.value })} /><Button size="sm" onClick={() => { if (s.all) for (const col of d.cols) if (!col.due) col.due = s.all; setS(s => ({ ...s })); }}>{t('class.bki_use_it')}</Button></label>
        <Select label={t('class.bki_unit_go')} value={s.unit} options={c.units.map(u => ({ value: u.id, label: u.name })).concat({ value: '', label: t('class.bki_unit_new') })} onChange={v => set({ unit: v })} /></div>
      {d.cols.some(y => y.on && !y.to && !y.due) && <p class="mute small">{t('class.bki_no_date')}</p>}
      <h3>{t('class.students')}</h3>
      {unmatched.length ? <><p class="small">{s.build ? t('class.bki_rows_build') : t('class.bki_rows_un', { n: unmatched.length })}</p>
        <table class="cp-ent"><tbody>{unmatched.map(([st, i]) => <tr><td data-raw>{st.name}</td><td><Select value={s.pick[i] || ''} aria-label={t('class.bki_who', { name: st.name })} data-bki-pick={i}
          options={[{ value: '', label: t('class.bki_leave_row') }, { value: '+', label: plusOk(i) ? t('class.bki_add_new') : t('class.bki_add_taken'), disabled: !plusOk(i) }].concat(absent.map(nm => ({ value: nm, label: nm })))} onChange={v => set({ pick: { ...s.pick, [i]: v } })} /></td></tr>)}</tbody></table></>
        : <p class="small">{t('class.bki_all_match')}</p>}
      {absent.length > 0 && !s.build && <p class="mute small">{t('class.bki_absent')} <span data-raw>{absent.join(', ')}</span></p>}
      {inf && (inf.add.length > 0 || inf.differ.length > 0) && <div><Checkbox checked={s.info} onChange={v => set({ info: v })} label={[t('class.bki_fill_ids', { n: inf.add.filter(y => y[1] === 'id').length }), t('class.bki_fill_mails', { n: inf.add.filter(y => y[1] === 'email').length })].filter((_, j) => inf.add.some(y => y[1] === (j ? 'email' : 'id'))).join(' ')} />
        {inf.differ.length > 0 && <p class="mute small">{t('class.bki_differ', { n: new Set(inf.differ).size })}</p>}</div>}
      {clash.length > 0 && <div class="cp-note cp-bkiclash" data-bki-clash><b>{t('class.bki_clash', { n: clash.length })}</b>
        <Segmented size="sm" label={t('class.bki_which')} value={Object.keys(s.over).length ? '' : s.keep ? 'keep' : 'file'} onChange={v => set({ keep: v === 'keep', over: {} })} options={[{ value: 'keep', label: t('class.bki_keep_all') }, { value: 'file', label: t('class.bki_file_all') }]} />
        <table class="cp-ent"><tbody>{clash.map(([q, y]) => { const f = useFile(q.col, y.who), k = q.col.i + '|' + y.who; return <tr><td data-raw>{q.it ? q.it.name : q.col.name}</td><td data-raw>{y.who}</td>
          <td><Segmented size="sm" label={t('class.bki_which_one', { name: y.who })} value={f ? 'file' : 'keep'} onChange={v => set({ over: { ...s.over, [k]: v } })} options={[{ value: 'keep', label: t('class.bki_mine', { v: show(y.was, q.max) }) }, { value: 'file', label: t('class.bki_files', { v: show(y.now, q.max) }) }]} /></td></tr>; })}</tbody></table></div>}
      {papers > 0 && <p class="mute small">{t('class.bki_papers', { n: papers })}</p>}
    </div>
  </Sheet>;
}
